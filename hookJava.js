Java.perform(function(){
   var socket = Java.use("java.net.Socket");

   console.log('Java Socket')

   socket.$init.overload().implementation = function(){
       console.log('Java Socket')
       return this.$init();
   };

   // socket.connect.overload('java.net.SocketAddress', 'int').implementation = function(socketAddr, timeout) {
   //      return  this.connect(socketAddr, timeout);
   // };

   // socket.send
    // socket.getInputStream.overloads[0].implementation = function() {
    //     console.log("  -----getInputStream")
    // }
});


// Java.perform(function() {
//     const HttpURLConnection = Java.use("com.android.okhttp.internal.huc.HttpURLConnectionImpl");
//     console.log("-------HttpURLConnectionImpl")


//     HttpURLConnection.getInputStream.overloads[0].implementation = function() {
//         console.log("  -----getInputStream")
//         console.log("asdfdsa");
//         return HttpURLConnection.getInputStream()
//     }
// })

function modifyJson(s) {
    try {
        let obj = JSON.parse(s);
        let a = obj.current.temperature.value;
        // obj.current.temperature.value = "666";
        let output = JSON.stringify(obj);
        return output.replaceAll(a, "");
    } catch {
        return s;
    }
}

const httpsUrlConnection = function() {
    const HttpsURLConnection = Java.use("com.android.okhttp.internal.huc.HttpsURLConnectionImpl");
    // const HttpsURLConnection = Java.use("java.net.HttpURLConnection");
    const ByteArrayInputStream = Java.use("java.io.ByteArrayInputStream");
    const ByteArrayOutputStream = Java.use("java.io.ByteArrayOutputStream");
    const BufferedReader = Java.use("java.io.BufferedReader");
    const InputStreamReader = Java.use("java.io.InputStreamReader");
    const JavaString = Java.use("java.lang.String");


    console.log("-------HttpsURLConnectionImpl")


    HttpsURLConnection.getInputStream.overloads[0].implementation = function() {
        console.log("  -----getInputStream")

        try {
            var methodURL = "";
            var responseHeaders = "";
            var responseBody = "";
            var Connection = this;
            var stream = this.getInputStream.overloads[0].apply(this, arguments);

            var requestURL = Connection.getURL().toString();
            var requestMethod = Connection.getRequestMethod();
            var requestProperties
            methodURL = requestMethod + " " + requestURL;
            if (Connection.getHeaderFields) {
                var Keys = Connection.getHeaderFields().keySet().toArray();
                var Values = Connection.getHeaderFields().values().toArray();
                responseHeaders = "";
                for (var key in Keys) {
                    if (Keys[key] && Keys[key] !== null && Values[key]) {
                        responseHeaders += Keys[key] + ": " + Values[key].toString().replace(/\[/gi, "").replace(/\]/gi, "") + "\n";
                    } else if (Values[key]) {
                        responseHeaders += Values[key].toString().replace(/\[/gi, "").replace(/\]/gi, "") + "\n";
                    }
                }
            }

            //console.log("--Https Header:\n" + responseHeaders)
            console.log("Spoofing HTTPS response body...")
            var retval;
            if (stream) {
                var baos = ByteArrayOutputStream.$new();
                var buffer = -1;

                var BufferedReaderStream = BufferedReader.$new(InputStreamReader.$new(stream));
                while ((buffer =stream.read()) != -1){
                    baos.write(buffer);
                    responseBody += String.fromCharCode(buffer);
                }

                var s2 = JavaString.$new(modifyJson(responseBody));
                
                BufferedReaderStream.close();
                baos.flush();
                //retval = ByteArrayInputStream.$new(baos.toByteArray());
                retval = ByteArrayInputStream.$new(s2.getBytes());
            }

            //console.log("--Https Body:\n" + responseBody);

            /*   --- Payload Header --- */


            // var send_data = {};
            // send_data.time = new Date();
            // send_data.txnType = 'HTTPS';
            // send_data.lib = 'com.android.okhttp.internal.huc.HttpsURLConnectionImpl';
            // send_data.method = 'getInputStream';
            // send_data.artifact = [];
            // /*   --- Payload Body --- */
            // var data = {};
            // data.name = "Request/Response";
            // data.value = methodURL + "\n" + requestHeaders + "\n" + requestBody + "\n\n" + responseHeaders + "\n" + responseBody;
            // data.argSeq = 0;
            // send_data.artifact.push(data);
            // send(JSON.stringify(send_data));

            if(retval) return retval;
            return stream;
        } catch (e) {
            console.log(e);
            this.getInputStream.overloads[0].apply(this, arguments);
        }
    }
}
// Java.perform(httpsUrlConnection);


Java.perform(function() {
  var pSize = Process.pointerSize;
  var env = Java.vm.getEnv();
  var RegisterNatives = 215, FindClassIndex = 6; // search "215" @ https://docs.oracle.com/javase/8/docs/technotes/guides/jni/spec/functions.html
  var jclassAddress2NameMap = {};
  function getNativeAddress(idx) {
    return env.handle.readPointer().add(idx * pSize).readPointer();
  }
  // intercepting FindClass to populate Map<address, jclass>
  Interceptor.attach(getNativeAddress(FindClassIndex), {
    onEnter: function(args) {
      jclassAddress2NameMap[args[0]] = args[1].readCString();
    }
  });
  // RegisterNative(jClass*, .., JNINativeMethod *methods[nMethods], uint nMethods) // https://android.googlesource.com/platform/libnativehelper/+/master/include_jni/jni.h#977
  Interceptor.attach(getNativeAddress(RegisterNatives), {
    onEnter: function(args) {
      for (var i = 0, nMethods = parseInt(args[3]); i < nMethods; i++) {
        /*
          https://android.googlesource.com/platform/libnativehelper/+/master/include_jni/jni.h#129
          typedef struct {
             const char* name;
             const char* signature;
             void* fnPtr;
          } JNINativeMethod;
        */
        var structSize = pSize * 3; // = sizeof(JNINativeMethod)
        var methodsPtr = ptr(args[2]);
        var signature = methodsPtr.add(i * structSize + pSize).readPointer();
        var fnPtr = methodsPtr.add(i * structSize + (pSize * 2)).readPointer(); // void* fnPtr
        var jClass = jclassAddress2NameMap[args[0]].split('/');
  var methodName = methodsPtr.add(i * structSize).readPointer().readCString();
        console.log('\x1b[3' + '6;01' + 'm', JSON.stringify({
          module: DebugSymbol.fromAddress(fnPtr)['moduleName'], // https://www.frida.re/docs/javascript-api/#debugsymbol
          package: jClass.slice(0, -1).join('.'),
          class: jClass[jClass.length - 1],
          method: methodName, // methodsPtr.readPointer().readCString(), // char* name
          signature: signature.readCString(), // char* signature TODO Java bytecode signature parser { Z: 'boolean', B: 'byte', C: 'char', S: 'short', I: 'int', J: 'long', F: 'float', D: 'double', L: 'fully-qualified-class;', '[': 'array' } https://github.com/skylot/jadx/blob/master/jadx-core/src/main/java/jadx/core/dex/nodes/parser/SignatureParser.java
          address: fnPtr
        }), '\x1b[39;49;00m');
      }
    }
  });
});



const unpinning = function() {
    console.log("---");
    console.log("Unpinning Android app...");

    // HttpsURLConnection
    try {
        const HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
        HttpsURLConnection.setDefaultHostnameVerifier.implementation = function (hostnameVerifier) {
            console.log('  --> Bypassing HttpsURLConnection (setDefaultHostnameVerifier)');
            return; // Do nothing, i.e. don't change the hostname verifier
        };
        console.log('[+] HttpsURLConnection (setDefaultHostnameVerifier)');
    } catch (err) {
        console.log('[ ] HttpsURLConnection (setDefaultHostnameVerifier)');
    }
    try {
        const HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
        HttpsURLConnection.setSSLSocketFactory.implementation = function (SSLSocketFactory) {
            console.log('  --> Bypassing HttpsURLConnection (setSSLSocketFactory)');
            return; // Do nothing, i.e. don't change the SSL socket factory
        };
        console.log('[+] HttpsURLConnection (setSSLSocketFactory)');
    } catch (err) {
        console.log('[ ] HttpsURLConnection (setSSLSocketFactory)');
    }
    try {
        const HttpsURLConnection = Java.use("javax.net.ssl.HttpsURLConnection");
        HttpsURLConnection.setHostnameVerifier.implementation = function (hostnameVerifier) {
            console.log('  --> Bypassing HttpsURLConnection (setHostnameVerifier)');
            return; // Do nothing, i.e. don't change the hostname verifier
        };
        console.log('[+] HttpsURLConnection (setHostnameVerifier)');
    } catch (err) {
        console.log('[ ] HttpsURLConnection (setHostnameVerifier)');
    }

    // SSLContext
    try {
        const X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        const SSLContext = Java.use('javax.net.ssl.SSLContext');

        const TrustManager = Java.registerClass({
            // Implement a custom TrustManager
            name: 'dev.asd.test.TrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function (chain, authType) { },
                checkServerTrusted: function (chain, authType) { },
                getAcceptedIssuers: function () { return []; }
            }
        });

        // Prepare the TrustManager array to pass to SSLContext.init()
        const TrustManagers = [TrustManager.$new()];

        // Get a handle on the init() on the SSLContext class
        const SSLContext_init = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;', '[Ljavax.net.ssl.TrustManager;', 'java.security.SecureRandom'
        );

        // Override the init method, specifying the custom TrustManager
        SSLContext_init.implementation = function (keyManager, trustManager, secureRandom) {
            console.log('  --> Bypassing Trustmanager (Android < 7) request');
            SSLContext_init.call(this, keyManager, TrustManagers, secureRandom);
        };
        console.log('[+] SSLContext');
    } catch (err) {
        console.log('[ ] SSLContext');
    }

    // TrustManagerImpl (Android > 7)
    try {
        const array_list = Java.use("java.util.ArrayList");
        const TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');

        // This step is notably what defeats the most common case: network security config
        TrustManagerImpl.checkTrustedRecursive.implementation = function(a1, a2, a3, a4, a5, a6) {
            console.log('  --> Bypassing TrustManagerImpl checkTrusted ');
            return array_list.$new();
        }

        TrustManagerImpl.verifyChain.implementation = function (untrustedChain, trustAnchorChain, host, clientAuth, ocspData, tlsSctData) {
            console.log('  --> Bypassing TrustManagerImpl verifyChain: ' + host);
            return untrustedChain;
        };
        console.log('[+] TrustManagerImpl');
    } catch (err) {
        console.log('[ ] TrustManagerImpl');
    }

    // OkHTTPv3 (quadruple bypass)
    try {
        // Bypass OkHTTPv3 {1}
        const okhttp3_Activity_1 = Java.use('okhttp3.CertificatePinner');
        okhttp3_Activity_1.check.overload('java.lang.String', 'java.util.List').implementation = function (a, b) {
            console.log('  --> Bypassing OkHTTPv3 (list): ' + a);
            return;
        };
        console.log('[+] OkHTTPv3 (list)');
    } catch (err) {
        console.log('[ ] OkHTTPv3 (list)');
    }
    try {
        // Bypass OkHTTPv3 {2}
        // This method of CertificatePinner.check could be found in some old Android app
        const okhttp3_Activity_2 = Java.use('okhttp3.CertificatePinner');
        okhttp3_Activity_2.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function (a, b) {
            console.log('  --> Bypassing OkHTTPv3 (cert): ' + a);
            return;
        };
        console.log('[+] OkHTTPv3 (cert)');
    } catch (err) {
        console.log('[ ] OkHTTPv3 (cert)');
    }
    try {
        // Bypass OkHTTPv3 {3}
        const okhttp3_Activity_3 = Java.use('okhttp3.CertificatePinner');
        okhttp3_Activity_3.check.overload('java.lang.String', '[Ljava.security.cert.Certificate;').implementation = function (a, b) {
            console.log('  --> Bypassing OkHTTPv3 (cert array): ' + a);
            return;
        };
        console.log('[+] OkHTTPv3 (cert array)');
    } catch (err) {
        console.log('[ ] OkHTTPv3 (cert array)');
    }
    try {
        // Bypass OkHTTPv3 {4}
        const okhttp3_Activity_4 = Java.use('okhttp3.CertificatePinner');
        okhttp3_Activity_4['check$okhttp'].implementation = function (a, b) {
            console.log('  --> Bypassing OkHTTPv3 ($okhttp): ' + a);
            return;
        };
        console.log('[+] OkHTTPv3 ($okhttp)');
    } catch (err) {
        console.log('[ ] OkHTTPv3 ($okhttp)');
    }

    // Trustkit (triple bypass)
    try {
        // Bypass Trustkit {1}
        const trustkit_Activity_1 = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
        trustkit_Activity_1.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) {
            console.log('  --> Bypassing Trustkit OkHostnameVerifier(SSLSession): ' + a);
            return true;
        };
        console.log('[+] Trustkit OkHostnameVerifier(SSLSession)');
    } catch (err) {
        console.log('[ ] Trustkit OkHostnameVerifier(SSLSession)');
    }
    try {
        // Bypass Trustkit {2}
        const trustkit_Activity_2 = Java.use('com.datatheorem.android.trustkit.pinning.OkHostnameVerifier');
        trustkit_Activity_2.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) {
            console.log('  --> Bypassing Trustkit OkHostnameVerifier(cert): ' + a);
            return true;
        };
        console.log('[+] Trustkit OkHostnameVerifier(cert)');
    } catch (err) {
        console.log('[ ] Trustkit OkHostnameVerifier(cert)');
    }
    try {
        // Bypass Trustkit {3}
        const trustkit_PinningTrustManager = Java.use('com.datatheorem.android.trustkit.pinning.PinningTrustManager');
        trustkit_PinningTrustManager.checkServerTrusted.implementation = function () {
            console.log('  --> Bypassing Trustkit PinningTrustManager');
        };
        console.log('[+] Trustkit PinningTrustManager');
    } catch (err) {
        console.log('[ ] Trustkit PinningTrustManager');
    }

    // Appcelerator Titanium
    try {
        const appcelerator_PinningTrustManager = Java.use('appcelerator.https.PinningTrustManager');
        appcelerator_PinningTrustManager.checkServerTrusted.implementation = function () {
            console.log('  --> Bypassing Appcelerator PinningTrustManager');
        };
        console.log('[+] Appcelerator PinningTrustManager');
    } catch (err) {
        console.log('[ ] Appcelerator PinningTrustManager');
    }

    // OpenSSLSocketImpl Conscrypt
    try {
        const OpenSSLSocketImpl = Java.use('com.android.org.conscrypt.OpenSSLSocketImpl');
        OpenSSLSocketImpl.verifyCertificateChain.implementation = function (certRefs, JavaObject, authMethod) {
            console.log('  --> Bypassing OpenSSLSocketImpl Conscrypt');
        };
        console.log('[+] OpenSSLSocketImpl Conscrypt');
    } catch (err) {
        console.log('[ ] OpenSSLSocketImpl Conscrypt');
    }

    // OpenSSLEngineSocketImpl Conscrypt
    try {
        const OpenSSLEngineSocketImpl_Activity = Java.use('com.android.org.conscrypt.OpenSSLEngineSocketImpl');
        OpenSSLEngineSocketImpl_Activity.verifyCertificateChain.overload('[Ljava.lang.Long;', 'java.lang.String').implementation = function (a, b) {
            console.log('  --> Bypassing OpenSSLEngineSocketImpl Conscrypt: ' + b);
        };
        console.log('[+] OpenSSLEngineSocketImpl Conscrypt');
    } catch (err) {
        console.log('[ ] OpenSSLEngineSocketImpl Conscrypt');
    }

    // OpenSSLSocketImpl Apache Harmony
    try {
        const OpenSSLSocketImpl_Harmony = Java.use('org.apache.harmony.xnet.provider.jsse.OpenSSLSocketImpl');
        OpenSSLSocketImpl_Harmony.verifyCertificateChain.implementation = function (asn1DerEncodedCertificateChain, authMethod) {
            console.log('  --> Bypassing OpenSSLSocketImpl Apache Harmony');
        };
        console.log('[+] OpenSSLSocketImpl Apache Harmony');
    } catch (err) {
        console.log('[ ] OpenSSLSocketImpl Apache Harmony');
    }

    // PhoneGap sslCertificateChecker (https://github.com/EddyVerbruggen/SSLCertificateChecker-PhoneGap-Plugin)
    try {
        const phonegap_Activity = Java.use('nl.xservices.plugins.sslCertificateChecker');
        phonegap_Activity.execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext').implementation = function (a, b, c) {
            console.log('  --> Bypassing PhoneGap sslCertificateChecker: ' + a);
            return true;
        };
        console.log('[+] PhoneGap sslCertificateChecker');
    } catch (err) {
        console.log('[ ] PhoneGap sslCertificateChecker');
    }

    // IBM MobileFirst pinTrustedCertificatePublicKey (double bypass)
    try {
        // Bypass IBM MobileFirst {1}
        const WLClient_Activity_1 = Java.use('com.worklight.wlclient.api.WLClient');
        WLClient_Activity_1.getInstance().pinTrustedCertificatePublicKey.overload('java.lang.String').implementation = function (cert) {
            console.log('  --> Bypassing IBM MobileFirst pinTrustedCertificatePublicKey (string): ' + cert);
            return;
        };
        console.log('[+] IBM MobileFirst pinTrustedCertificatePublicKey (string)');
    } catch (err) {
        console.log('[ ] IBM MobileFirst pinTrustedCertificatePublicKey (string)');
    }
    try {
        // Bypass IBM MobileFirst {2}
        const WLClient_Activity_2 = Java.use('com.worklight.wlclient.api.WLClient');
        WLClient_Activity_2.getInstance().pinTrustedCertificatePublicKey.overload('[Ljava.lang.String;').implementation = function (cert) {
            console.log('  --> Bypassing IBM MobileFirst pinTrustedCertificatePublicKey (string array): ' + cert);
            return;
        };
        console.log('[+] IBM MobileFirst pinTrustedCertificatePublicKey (string array)');
    } catch (err) {
        console.log('[ ] IBM MobileFirst pinTrustedCertificatePublicKey (string array)');
    }

    // IBM WorkLight (ancestor of MobileFirst) HostNameVerifierWithCertificatePinning (quadruple bypass)
    try {
        // Bypass IBM WorkLight {1}
        const worklight_Activity_1 = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
        worklight_Activity_1.verify.overload('java.lang.String', 'javax.net.ssl.SSLSocket').implementation = function (a, b) {
            console.log('  --> Bypassing IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSocket): ' + a);
            return;
        };
        console.log('[+] IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSocket)');
    } catch (err) {
        console.log('[ ] IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSocket)');
    }
    try {
        // Bypass IBM WorkLight {2}
        const worklight_Activity_2 = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
        worklight_Activity_2.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) {
            console.log('  --> Bypassing IBM WorkLight HostNameVerifierWithCertificatePinning (cert): ' + a);
            return;
        };
        console.log('[+] IBM WorkLight HostNameVerifierWithCertificatePinning (cert)');
    } catch (err) {
        console.log('[ ] IBM WorkLight HostNameVerifierWithCertificatePinning (cert)');
    }
    try {
        // Bypass IBM WorkLight {3}
        const worklight_Activity_3 = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
        worklight_Activity_3.verify.overload('java.lang.String', '[Ljava.lang.String;', '[Ljava.lang.String;').implementation = function (a, b) {
            console.log('  --> Bypassing IBM WorkLight HostNameVerifierWithCertificatePinning (string string): ' + a);
            return;
        };
        console.log('[+] IBM WorkLight HostNameVerifierWithCertificatePinning (string string)');
    } catch (err) {
        console.log('[ ] IBM WorkLight HostNameVerifierWithCertificatePinning (string string)');
    }
    try {
        // Bypass IBM WorkLight {4}
        const worklight_Activity_4 = Java.use('com.worklight.wlclient.certificatepinning.HostNameVerifierWithCertificatePinning');
        worklight_Activity_4.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) {
            console.log('  --> Bypassing IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSession): ' + a);
            return true;
        };
        console.log('[+] IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSession)');
    } catch (err) {
        console.log('[ ] IBM WorkLight HostNameVerifierWithCertificatePinning (SSLSession)');
    }

    // Conscrypt CertPinManager
    try {
        const conscrypt_CertPinManager_Activity = Java.use('com.android.org.conscrypt.CertPinManager');
        conscrypt_CertPinManager_Activity.isChainValid.overload('java.lang.String', 'java.util.List').implementation = function (a, b) {
            console.log('  --> Bypassing Conscrypt CertPinManager: ' + a);
            return true;
        };
        console.log('[+] Conscrypt CertPinManager');
    } catch (err) {
        console.log('[ ] Conscrypt CertPinManager');
    }

    // CWAC-Netsecurity (unofficial back-port pinner for Android<4.2) CertPinManager
    try {
        const cwac_CertPinManager_Activity = Java.use('com.commonsware.cwac.netsecurity.conscrypt.CertPinManager');
        cwac_CertPinManager_Activity.isChainValid.overload('java.lang.String', 'java.util.List').implementation = function (a, b) {
            console.log('  --> Bypassing CWAC-Netsecurity CertPinManager: ' + a);
            return true;
        };
        console.log('[+] CWAC-Netsecurity CertPinManager');
    } catch (err) {
        console.log('[ ] CWAC-Netsecurity CertPinManager');
    }

    // Worklight Androidgap WLCertificatePinningPlugin
    try {
        const androidgap_WLCertificatePinningPlugin_Activity = Java.use('com.worklight.androidgap.plugin.WLCertificatePinningPlugin');
        androidgap_WLCertificatePinningPlugin_Activity.execute.overload('java.lang.String', 'org.json.JSONArray', 'org.apache.cordova.CallbackContext').implementation = function (a, b, c) {
            console.log('  --> Bypassing Worklight Androidgap WLCertificatePinningPlugin: ' + a);
            return true;
        };
        console.log('[+] Worklight Androidgap WLCertificatePinningPlugin');
    } catch (err) {
        console.log('[ ] Worklight Androidgap WLCertificatePinningPlugin');
    }

    // Netty FingerprintTrustManagerFactory
    try {
        const netty_FingerprintTrustManagerFactory = Java.use('io.netty.handler.ssl.util.FingerprintTrustManagerFactory');
        netty_FingerprintTrustManagerFactory.checkTrusted.implementation = function (type, chain) {
            console.log('  --> Bypassing Netty FingerprintTrustManagerFactory');
        };
        console.log('[+] Netty FingerprintTrustManagerFactory');
    } catch (err) {
        console.log('[ ] Netty FingerprintTrustManagerFactory');
    }

    // Squareup CertificatePinner [OkHTTP<v3] (double bypass)
    try {
        // Bypass Squareup CertificatePinner {1}
        const Squareup_CertificatePinner_Activity_1 = Java.use('com.squareup.okhttp.CertificatePinner');
        Squareup_CertificatePinner_Activity_1.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function (a, b) {
            console.log('  --> Bypassing Squareup CertificatePinner (cert): ' + a);
            return;
        };
        console.log('[+] Squareup CertificatePinner (cert)');
    } catch (err) {
        console.log('[ ] Squareup CertificatePinner (cert)');
    }
    try {
        // Bypass Squareup CertificatePinner {2}
        const Squareup_CertificatePinner_Activity_2 = Java.use('com.squareup.okhttp.CertificatePinner');
        Squareup_CertificatePinner_Activity_2.check.overload('java.lang.String', 'java.util.List').implementation = function (a, b) {
            console.log('  --> Bypassing Squareup CertificatePinner (list): ' + a);
            return;
        };
        console.log('[+] Squareup CertificatePinner (list)');
    } catch (err) {
        console.log('[ ] Squareup CertificatePinner (list)');
    }

    // Squareup OkHostnameVerifier [OkHTTP v3] (double bypass)
    try {
        // Bypass Squareup OkHostnameVerifier {1}
        const Squareup_OkHostnameVerifier_Activity_1 = Java.use('com.squareup.okhttp.internal.tls.OkHostnameVerifier');
        Squareup_OkHostnameVerifier_Activity_1.verify.overload('java.lang.String', 'java.security.cert.X509Certificate').implementation = function (a, b) {
            console.log('  --> Bypassing Squareup OkHostnameVerifier (cert): ' + a);
            return true;
        };
        console.log('[+] Squareup OkHostnameVerifier (cert)');
    } catch (err) {
        console.log('[ ] Squareup OkHostnameVerifier (cert)');
    }
    try {
        // Bypass Squareup OkHostnameVerifier {2}
        const Squareup_OkHostnameVerifier_Activity_2 = Java.use('com.squareup.okhttp.internal.tls.OkHostnameVerifier');
        Squareup_OkHostnameVerifier_Activity_2.verify.overload('java.lang.String', 'javax.net.ssl.SSLSession').implementation = function (a, b) {
            console.log('  --> Bypassing Squareup OkHostnameVerifier (SSLSession): ' + a);
            return true;
        };
        console.log('[+] Squareup OkHostnameVerifier (SSLSession)');
    } catch (err) {
        console.log('[ ] Squareup OkHostnameVerifier (SSLSession)');
    }

    // Android WebViewClient (double bypass)
    try {
        // Bypass WebViewClient {1} (deprecated from Android 6)
        const AndroidWebViewClient_Activity_1 = Java.use('android.webkit.WebViewClient');
        AndroidWebViewClient_Activity_1.onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError').implementation = function (obj1, obj2, obj3) {
            console.log('  --> Bypassing Android WebViewClient (SslErrorHandler)');
        };
        console.log('[+] Android WebViewClient (SslErrorHandler)');
    } catch (err) {
        console.log('[ ] Android WebViewClient (SslErrorHandler)');
    }
    try {
        // Bypass WebViewClient {2}
        const AndroidWebViewClient_Activity_2 = Java.use('android.webkit.WebViewClient');
        AndroidWebViewClient_Activity_2.onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.WebResourceRequest', 'android.webkit.WebResourceError').implementation = function (obj1, obj2, obj3) {
            console.log('  --> Bypassing Android WebViewClient (WebResourceError)');
        };
        console.log('[+] Android WebViewClient (WebResourceError)');
    } catch (err) {
        console.log('[ ] Android WebViewClient (WebResourceError)');
    }

    // Apache Cordova WebViewClient
    try {
        const CordovaWebViewClient_Activity = Java.use('org.apache.cordova.CordovaWebViewClient');
        CordovaWebViewClient_Activity.onReceivedSslError.overload('android.webkit.WebView', 'android.webkit.SslErrorHandler', 'android.net.http.SslError').implementation = function (obj1, obj2, obj3) {
            console.log('  --> Bypassing Apache Cordova WebViewClient');
            obj3.proceed();
        };
    } catch (err) {
        console.log('[ ] Apache Cordova WebViewClient');
    }

    // Boye AbstractVerifier
    try {
        const boye_AbstractVerifier = Java.use('ch.boye.httpclientandroidlib.conn.ssl.AbstractVerifier');
        boye_AbstractVerifier.verify.implementation = function (host, ssl) {
            console.log('  --> Bypassing Boye AbstractVerifier: ' + host);
        };
    } catch (err) {
        console.log('[ ] Boye AbstractVerifier');
    }
}

Java.perform(unpinning);

