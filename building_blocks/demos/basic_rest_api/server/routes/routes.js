var fs = require("fs");
var ipfsAPI = require('ipfs-api')
var bl = require('bl')
var Promise = require('promise')
var json = JSON.parse(fs.readFileSync('files/sample_cert.json', 'utf8'));

var cert_rules = JSON.parse(fs.readFileSync('files/cert_test_rules_ipfs.json', 'utf8'));
var cert_proofs = JSON.parse(fs.readFileSync('files/cert_test_proofs_ipfs.json', 'utf8'));
var revocationStatus = true;

var mock_proofs_ipfs_file_link = "QmSMppxttp5ioaZwmSWCWHnwMGUasmQRtcE3TdtMy2vAJG";
var mock_rules_ipfs_file_link = "QmTcr8MMP6XQYDigMYY6YnemGHTMtETZ8FXvgNsCLVF3ht";
var ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'})

//sample cert: QmdWaUeoKCbMRTndAWAqXw52tBUPogGvkrWtoVwdRpYDAB

function promiseVerifySignatures(files_array){
  var cert_rules = JSON.parse(files_array[0])
  var cert_proofs = JSON.parse(files_array[1])

  return new Promise(function(fulfill,reject){
    cert_rules["revocation_rules"].forEach(function(element){
      //console.log(element);
      if(! cert_proofs["proofs"].includes(element)){
        revocationStatus = false;
      }
    })
    fulfill(revocationStatus)
  })

}

function verifySignatures(cert_rules, cert_proofs){

  cert_rules["revocation_rules"].forEach(function(element){
    //console.log(element);
    if(! cert_proofs["proofs"].includes(element)){
      revocationStatus = false;
    }
  });
  return revocationStatus;
}
//QmTcr8MMP6XQYDigMYY6YnemGHTMtETZ8FXvgNsCLVF3ht
function mockGetProofsFile(ipfs_proofs_link){return cert_proofs}

function mockGetRulesFile(ipfs_rules_link){return cert_rules}


function getRulesProofs(cert_raw){
  var cert = JSON.parse(cert_raw.toString())
  var rules_link = cert['document']['verify']['ipfs_files']['rules']
  var proofs_link = cert['document']['verify']['ipfs_files']['proofs']

  var rules_promise = getIPFSCert(rules_link)
  var proofs_promise = getIPFSCert(proofs_link)

  return new Promise.all([rules_promise,proofs_promise])

}

function getIPFSCert(multihash){
  return new Promise(function(fulfill,reject){
    ipfs.files.cat(multihash,function (err,file) {
      console.log("Fetching... "+multihash)
      file.pipe(bl(function(err,data){


        //var cert = JSON.parse(data.toString())
        //console.log(cert['document']['verify']['ipfs_files'])
        fulfill(data.toString())

      }));
    })
  })

}

var appRouter = function(app) {

  app.get('/promise',function(req,res){
    if (req.method == 'GET'){
      var ipfs_addr= req.query.ipfsAddr
      getIPFSCert(ipfs_addr)
        .then(getRulesProofs)
        .then(promiseVerifySignatures)
        .then(function(result){
          console.log(result.toString())
          res.end(result.toString())
        })
    }
  })

  // /getcert?ipfsAddr=$multihash
  app.get('/getcert', function(req,res){
    if (req.method == 'GET'){
      var ipfs_addr= req.query.ipfsAddr
      console.log(ipfs_addr)
      ipfs.files.cat(ipfs_addr,function (err,file) {
        file.pipe(bl(function(err,data){

          var cert = JSON.parse(data.toString())
          console.log(cert)

          res.end(data.toString())

        }));
      })
    }else
      res.end('ciao')
  })

  // /verify?ipfsAddr=$multihash
  app.get('/verify', function(req,response){
    if (req.method == 'GET'){
      var ipfs_addr= req.query.ipfsAddr
      console.log(ipfs_addr)
      ipfs.files.cat(ipfs_addr,function (err,file) {
        file.pipe(bl(function(err,data){

          var cert = JSON.parse(data.toString())

          try{

            try {
              var cert_proofs_link = cert["document"]["verify"]["ipfs_files"]["proofs"];
              var cert_rules_link = cert["document"]["verify"]["ipfs_files"]["rules"];
            }catch (error){
              throw "cert schema does not meet requirements";
            }

            if (cert_proofs_link == mock_proofs_ipfs_file_link && cert_rules_link == mock_rules_ipfs_file_link){
              console.log("proofs: "+cert_proofs_link);
              console.log("rules: "+cert_rules_link);
            } else{
              throw "invalid ipfs links";
            }

            var cert_proofs_file = mockGetProofsFile(cert_proofs_link);
            var cert_rules_file= mockGetRulesFile(cert_rules_link);

            var res = "This certificate is NOT revoked"
            if (verifySignatures(cert_rules_file,cert_proofs_file)){
              res = "This certificate is revoked."
            }
            response.send(res);    // echo the result back
          }catch (e){
            console.log(e);
            response.send(e);
          }





        }));
      })
    }else
      res.end('ciao')
  })

  app.post('/', function(request, response){
    try{
      console.log(request.body);      // your JSON

      try {
        var cert_proofs_link = request.body["document"]["verify"]["ipfs_files"]["proofs"];
        var cert_rules_link = request.body["document"]["verify"]["ipfs_files"]["rules"];
      }catch (error){
        throw "cert schema does not meet requirements";
      }

      if (cert_proofs_link == mock_proofs_ipfs_file_link && cert_rules_link == mock_rules_ipfs_file_link){
        console.log("proofs: "+cert_proofs_link);
        console.log("rules: "+cert_rules_link);
      } else{
        throw "invalid ipfs links";
      }

      var cert_proofs_file = mockGetProofsFile(cert_proofs_link);
      var cert_rules_file= mockGetRulesFile(cert_rules_link);

      var res = "This certificate is NOT revoked"
      if (verifySignatures(cert_rules_file,cert_proofs_file)){
        res = "This certificate is revoked."
      }
      response.send(res);    // echo the result back
    }catch (e){
      console.log(e);
      response.send(e);
    }
  });

}

module.exports = appRouter;
