/*
 * Frida script to trace TCP connections of Android apps by MaMe82
 * - based on libc.so!connect()
 * - adds Java backtrace if calling thread is attached to JVM (omitted otherwise)
 * - results could be used to correlate data to inbound connections on TLS interception proxies
 * - credz to "Ole André V. Ravnås" for the online discussion (ref: https://twitter.com/mame82/status/1324654507117187072)
 *
 * Note: the code is a modified excerpt of an agent written in TypeScript. This version is pure JS but may require
 * some "performance rework" on the generated message objects
 *
 * Usage:
 *    frida -U --no-pause --codeshare mame82/android-tcp-trace -f <app/process>
 */
function hexdumpMem(addr){
    if(Process.findRangeByAddress(addr)){
        return hexdump(ptr(addr),{length:0x40})+"\r\n"
    }else{
        return ptr(addr)+"\r\n";
    }
}

function getAllModules() {
    var modules = Process.enumerateModules();
    const res = [];
    for (var i in modules){
        var module = modules[i];
        let name = module.name;
        if (name.indexOf("target.so") > -1 ){
            name = module.base;
        }
        res.push(name);
    }
    return res;
}
// console.log(getAllModules()); 

function getSymbols(moduleName) {
    var symbols = Process.findModuleByName(moduleName).enumerateSymbols();
    const res = [];
    for (var i in symbols) {
        var sym = symbols[i];
        res.push(sym.name);
    }
    return res;
}
// console.log(getSymbols("libc.so"));

function findSymbolModule(symbol) {
    const res = [];
    const modules = getAllModules();
    for (var m of modules) {
        const symbols = getSymbols(m);
        for (var s of symbols) {
            if (s === symbol) {
                res.push(m);
                break;
            }
        }
    }
    return res;
}
console.log(findSymbolModule("dns_query"));

// Module.getExportByName(null, "getaddrinfo");

function hookNativeAddr() {
  const tcpSocketFDs = new Map()
  const pSize = Process.pointerSize;
  // console.log(pSize)

  const getaddrinfo = Module.getExportByName("libc.so", "getaddrinfo")
  let new_func = new NativeFunction(getaddrinfo, "int", ["pointer", "pointer", "pointer", "pointer"]);
 
  var argss = [];
  var preHost;
  Interceptor.attach(getaddrinfo, {
    onEnter(args) {
      console.log("----------------------getaddrinfo---------------------")
      preHost = args[0].readCString();
      console.log("Original Host: " + preHost);
      console.log(args[1].readCString());

      argss = [args[0], args[1], args[2], args[3]];
      
      // console.log(JSON.stringify(this.context))
      // console.log(hexdumpMem(args[1]))
      // console.log(args[1].readUtf8String())
    },
    onLeave(retval) {
      console.log('Original retval ' + retval.toInt32())

      // const host = "info.cern.ch";
      const host = "ucla.edu";
      if (!preHost.endsWith(host)) {
        console.log(">>>>>>>Going to: " + host);
        let newHost = new NativePointer(argss[0]);
        newHost.writeUtf8String(host);

        let ret = new_func(newHost, argss[1], argss[2], argss[3]);
        retval.replace(ret);
        
        console.log('New retval ' + retval.toInt32());
      }
      
      console.log("-----------------------\n");
    }
  })
}

 hookNativeAddr();

function hookNativeSocketData() {
  const tcpSocketFDs = new Map()
  const pSize = Process.pointerSize;
  console.log(pSize)

  const fSocketSend = Module.getExportByName("libc.so", "recvmsg")
  console.log(fSocketSend)
  var ret_val = 0
  let new_func = new NativeFunction(fSocketSend, "int", ["pointer", "pointer", "int", "int"])

  Interceptor.attach(fSocketSend, {
    onEnter(args) {
      // console.log(args[3])
      // console.log(JSON.stringify(this.context))
      // console.log(hexdumpMem(args[1]))
      // console.log(args[1].readUtf8String())
      ret_val = new_func(args[0], args[1], args[2].toInt32(), args[3].toInt32())
    },
    onLeave(retval) {
      console.log('retval ' + retval.toInt32())
      retval.replace(ret_val)
    }
  })
}
//hookNativeSocketData()


function hookNativeSocket() {
  const tcpSocketFDs = new Map()

  const fSocketConnect = Module.getExportByName("libc.so", "connect")
  Interceptor.attach(fSocketConnect, {
    onEnter(args) {
      this.sockFd = args[0].toInt32()
    },
    onLeave(res) {
      const sockFd = this.sockFd
      const sockType = Socket.type(sockFd)
      if (!(sockType === "tcp6" || sockType === "tcp")) return

      const sockLocal = Socket.localAddress(sockFd)
      const tcpEpLocal = sockLocal && sockLocal.ip ? sockLocal : undefined
      const sockRemote = Socket.peerAddress(sockFd)
      const tcpEpRemote = sockRemote && sockRemote.ip ? sockRemote : undefined

      if (!tcpEpLocal) return
      // ToDo: if socket FD already exists in the set, a faked 'close' message shall be sent first (currently handled by receiving logic)
      tcpSocketFDs.set(sockFd, tcpEpLocal)
      let msg = {
        socketFd: sockFd,
        pid: Process.id,
        threadId: this.threadId,
        socketEventType: "connect",
        type: "socketCall",
        result: res
      }

      if (tcpEpLocal) {
        msg.hostip = tcpEpLocal.ip
        msg.port = tcpEpLocal.port
      }
      if (tcpEpRemote) {
        msg.dstIp = tcpEpRemote.ip
        msg.dstPort = tcpEpRemote.port
      }

      //if (Java.available) {     // checks presence of Java runtime in process
      if (Java.vm !== null && Java.vm.tryGetEnv() !== null) {
        // checks if Thread is JVM attached (JNI env available)
        let java_lang_Exception = Java.use("java.lang.Exception")
        var exception = java_lang_Exception.$new()
        const trace = exception.getStackTrace()
        msg.stack = trace.map(traceEl => {
          return {
            class: traceEl.getClassName(),
            file: traceEl.getFileName(),
            line: traceEl.getLineNumber(),
            method: traceEl.getMethodName(),
            isNative: traceEl.isNativeMethod(),
            str: traceEl.toString()
          }
        })
      }

      //send(msg)
      console.log(JSON.stringify(msg, null, 4))
    }
  })

  const libcEx = Process.getModuleByName("libc.so").enumerateExports()
  const socketExports = libcEx.filter(
    expDetails =>
      expDetails.type === "function" &&
      ["shutdown", "close"].some(serachStr => serachStr === expDetails.name)
  )
  socketExports.forEach(exp => {
    Interceptor.attach(exp.address, {
      onEnter(args) {
        const sockFd = args[0].toInt32()
        if (!tcpSocketFDs.has(sockFd)) return
        const sockType = Socket.type(sockFd)
        if (tcpSocketFDs.has(sockFd)) {
          const tcpEP = tcpSocketFDs.get(sockFd)
          const msg = {
            socketFd: sockFd,
            pid: Process.id,
            threadId: this.threadId,
            socketEventType: exp.name,
            hostip: tcpEP.ip,
            port: tcpEP.port,
            type: "socketCall"
          }
          tcpSocketFDs.delete(sockFd)
          //send(msg)
          console.log(JSON.stringify(msg, null, 4))
        }
      }
    })
  })
}
// hookNativeSocket()

