const axios = require('axios');
const connect = require('lotion-connect')
const port = 3000;
const {
  generatePrivateKey,
  generatePublicKey,
  toBuffer,
  hashTx,
  signTx
} = require('./cryptoKeys.js')

//TODO
// outsource crypto
// 1. add to server and make cors possible
// 2. connect different nodes
// add socket connection?
// search for chatbot api
// search for how to push down nodes!
// show block height? and make tendermint mine empty blocks false
// make text for which node to trust
// find a nice blockexplorer?
// include this error handling https://stackoverflow.com/questions/951791/javascript-global-error-handling/10556743#10556743

let encryptionHelper = (() => {
  getKeyAndIV = (key, callback) => {
    crypto.pseudoRandomBytes(16, (err, ivBuffer) => {
      var keyBuffer = (key instanceof Buffer) ? key : new Buffer(key);
      callback({
        iv: ivBuffer,
        key: keyBuffer
      });
    });
  }
  let encryptText = (cipher_alg, key, iv, text, encoding) => {
    var cipher = crypto.createCipheriv(cipher_alg, key, iv);
    encoding = encoding || "binary";
    var result = cipher.update(text, "utf8", encoding);
    result += cipher.final(encoding);
    return result;
  }
  let decryptText = (cipher_alg, key, iv, text, encoding) => {
    var decipher = crypto.createDecipheriv(cipher_alg, key, iv);
    encoding = encoding || "binary";
    var result = decipher.update(text, encoding);
    result += decipher.final();
    return result;
  }
  return {
    getKeyAndIV: getKeyAndIV,
    encryptText: encryptText,
    decryptText: decryptText
  };
})()




async function main() {
  try {
    /**
     * Append ws:// to the front of each validator IP address and the
     * tendermint port 46657 to the end. ws means connect via websockets
     * this step is required in order for connect to work
     */
    let nodes = 'ws://localhost:46657'

    //all clients share the same genesis file
    // TODO: acutally load the file
    let genesis = {
      "app_hash": "b600cc693f96924721e7e55944663e41e6410fe24a1dfbbb9befe8368673a372",
      "chain_id": "test-chain-OgmGOm",
      "genesis_time": "2018-10-07T22:09:10.308916005+02:00",
      "validators": [{
        "name": "Winkel",
        "power": 10,
        "pub_key": {
          "type": "AC26791624DE60",
          "value": "hNER7QpFepPULZU1HI4QwEdBrWT0ttCfegggEICt1y8="
        }
      }]
    }
    /**
     * Use Javascript object literal syntax to grab the current state of the data in the blockchain
     * and to grab the send function. Note the keyword async in the function above and the keyword
     * await here below.
     */
     // let { send, state } = await connect(null, { genesis, nodes}); not working
    let {
      send
    } = await connect(null, {
      genesis: genesis,
      nodes: ['ws://localhost:46657']
    })
    let chatWindow = document.getElementById('chat-window'),
      message = document.getElementById('message'),
      username = document.getElementById('username'),
      btn = document.getElementById('send'),
      output = document.getElementById('output'),
      feedback = document.getElementById('feedback'),
      privKeyOutput = document.getElementById('privKeyOutput'),
      pubKeyOutput = document.getElementById('pubKeyOutput'),
      genKeys = document.getElementById('genKeys'),
      option = document.getElementById('optionSelection')

    //Event listeners
    genKeys.addEventListener('click', () => {
      let privKey = generatePrivateKey()
      let pubKey = generatePublicKey(privKey)
      privKeyOutput.innerHTML = privKey
      pubKeyOutput.innerHTML = pubKey
    })

    // when user hits enter message is sent
    message.addEventListener('keydown', (e) => {
      // if(message.value ==='kill node 1'){
      //    sendMessage(username.value, 'killed node 1/2/3')
      //
      //  }
      if (e.keyCode === 13 && message.value.length >= 1 && message.value !== '') {
        let type = document.getElementById('slct')
        let messageType = type.options[type.selectedIndex].value
        sendMessage(username.value, message.value, messageType)
        message.value = ""
      }
    })
    //when user clicks send button message is sent
    btn.addEventListener('click', () => {
      if (message.value.length >= 1 && message.value !== '') {
        let type = document.getElementById('slct')
        let messageType = type.options[type.selectedIndex].value
        sendMessage(username.value, message.value, messageType)
        message.value = ""
      }
    })
    async function sendMessage(username, message, messageType) {
      let privKey = generatePrivateKey()
      let pubKey = generatePublicKey(privKey)
      privKeyOutput.innerHTML = privKey
      pubKeyOutput.innerHTML = pubKey
      switch (messageType) {
        case 'chooseOption':
          option.style.color = 'red'
          alert('choose an Option')
          break
        case 'normalMessage':
          console.log('sent normal message');
          let result = await send({
            sender: username,
            message: message
          })
          break
        case 'hashMessage':
          console.log('sent tx hash');
          let {
            txHash
          } = signTx(privKey, {
            sender: pubKey,
            message: message
          })
          console.log(txHash);
          await send({
            sender: username,
            message: txHash
          })
          break
        case 'signMessage':
          console.log('sent signed message');
          privKeyOutput.innerHTML = privKey
          pubKeyOutput.innerHTML = pubKey
          let passsword = pubKey.slice(0, 32)
          encryptionHelper.getKeyAndIV(passsword, async function(data) {
            let encText = encryptionHelper.encryptText("aes256", data.key, data.iv, message, "base64");
            await send({
              sender: username,
              message: encText
            })
          })
          break
      }
    }

    function decryptText(text, pubKey) {
      var decText = encryptionHelper.decryptText(algorithm, data.key, data.iv, encText, "base64");
    }

    let lastMessagesLength = 0
    //instead of setInterval one could use sockets to update the state
    async function updateState() {
      // let messages = await axios.get('http://localhost:' + 3000 + '/state').then(res => res.data)
      let {
        data
      } = await axios.get('http://localhost:' + 3000 + '/state')
      let messages = await data.messages
      if (messages !== undefined && messages.length > lastMessagesLength) {
        for (let i = lastMessagesLength; i < messages.length; i++) {
          // console.log(messages[i], i)
          let {
            sender,
            message
          } = messages[i]
          feedback.innerHTML = ''
          output.innerHTML += `<p class=sender> <strong> ${sender} : </strong> ${message}</p>`
        }
        //adjusting window
        chatWindow.scrollTop = chatWindow.scrollHeight
        lastMessagesLength = messages.length
      }
    }
    setInterval(async () => {
      updateState()
    }, 50)

  } catch (err) {
    console.log('error occured' + err);
  }
}

process.on('unhandledRejection', function(reason, p) {
  console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
  console.trace();
});

main();
