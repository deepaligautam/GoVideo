

var isRoomCreator = false
var peerConnection
var firstTime = true; //create and send answer only one time
var micButton = document.getElementById('micButton');
var cameraButton = document.getElementById('cameraButton');
var endButton = document.getElementById('endButton')
var room = document.getElementById('inputRoom').value
var name = document.getElementById('inputName').value
var formButton = document.getElementById('formButton');
var modal = document.getElementById('roomModal')
var ismicEnabled = true
var isCameraEnabled = true
var localStream;
//Media constraints
const constraints = {
  audio: true,
  video: true
};
//Initialize turn/stun server here
var iceServers = iceServersList;

//Initializing socket.io
const socket = io.connect();


//if room is created
socket.on('roomFull', function () {
  console.log("room is already full", room);
  modal.style.display = "block";
  alert('Cannot join this room, already full')
})

//if room is created
socket.on('roomCreated', function () {
  console.log("Created room", room)
  isRoomCreator = true;
  createRTCPeerConnection();
  streamLocalMedia();
})

//if room is joined
socket.on('roomJoined', function () {
  console.log("Joined room", room)
  socket.emit('askToCreateOffer', room);
})

//create and send offer
socket.on('createOffer', function () {
  if (isRoomCreator) {
    console.log('user1 is creating offer')
    createAndSendOffer();  //create Offer, SetLocalDescription and send offer
  }
})

//create connection ,add remoteoffer, add track, create answer, send answer
socket.on('offerReceived', function (description) {
  if (!isRoomCreator) {

    createRTCPeerConnection();

    //set remote description
    peerConnection.setRemoteDescription(description).then(function () {
      console.log('Remote Description added successfully', description)
      streamLocalMedia();
    })
      .catch(function (err) {
        /* handle the error */
        console.log("Remote Description cannot be added : ", err);
      });
    streamRemoteVideo()
  }
})

//set answer as remote description
socket.on('answerReceived', function (description) {
  if (isRoomCreator) {
    streamRemoteVideo();
    //set remote description
    peerConnection.setRemoteDescription(description).then(function () {
      console.log('Remote Description added successfully', description)

    })
      .catch(function (err) {
        /* handle the error */
        console.log("Remote Description cannot be added : ", err);
      });
  }
})

//adding new ice candidates
socket.on('candidate', function (event) {
  const candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate
  });
  peerConnection.addIceCandidate(candidate).then(() => {
    console.log('candidate added : ', candidate)
  })
    .catch(function (error) {
      console.log('candidate could not be added : ', candidate)
    })
})


//crating RTCPeerConnection and starting captuing remote video
function createRTCPeerConnection() {
  try {
    peerConnection = new RTCPeerConnection(iceServers);

  }
  catch (err) {
    console.log('Failed to create RTCPeerConnection : ' + err.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//this function will capture local video/audio
function streamLocalMedia() {
  navigator.mediaDevices.getUserMedia(constraints)     //promise
    .then(function (stream) {
      /* use the stream */
      document.getElementById('localVideo').srcObject = stream; //display to user

      //to turn off mic and camera
      localStream=stream;
      //disable enable mic
      micButton.addEventListener('click', micButtonHandler);
      //disable enable camera
      cameraButton.addEventListener('click', camButtonHandler);

      //add tracks to peer connection
      stream.getTracks().forEach(track => {
        console.log("Adding local track to peerconnection : ", track)
        peerConnection.addTrack(track, stream)
      });
    })
    .then(() => {
      //also create and send answer for user2
      if (!isRoomCreator && firstTime) {
        createAndSendAnswer();
        firstTime = false;
      }
      return
    })
    .catch(function (err) {
      /* handle the error */
      console.log("Video, Audio error : ", err);
    });
}


//start streaming remote video
function streamRemoteVideo() {
  peerConnection.ontrack = event => {
    document.getElementById('remoteVideo').srcObject = event.streams[0];
    console.log(event)
    console.log('.....fetching remote stream.....')
  }
}

//create Offer, SetLocalDescription and send offer
function createAndSendOffer() {
  let SDP = null
  //promise to create offer
  peerConnection.createOffer()
    .then(function (offer) {
      SDP = offer
      return peerConnection.setLocalDescription(offer)
    }).then(function () {
      socket.emit('sendOffer', SDP, room)
      console.log('Local Description is set', SDP)
    })
    .catch(function (err) {
      /* handle the error */
      console.log("Offer cannot be created : ", err);
    });
  genIceCandidate();//generate iceCandidates
}

//create answer, SetLocalDescription and send offer
function createAndSendAnswer() {
  let SDP = null
  //promise to create answer
  peerConnection.createAnswer()
    .then(function (offer) {
      SDP = offer
      peerConnection.setLocalDescription(offer)
    }).then(function () {
      socket.emit('sendAnswer', SDP, room)
      console.log('Local Description is set', SDP)
      console.log("answer created for user1 ", room, " , answer = ", SDP)
    })
    .catch(function (err) {
      /* handle the error */
      console.log("answer cannot be created : ", err);
    });
  genIceCandidate();//generate iceCandidates
}

//function to generate ice candidate
function genIceCandidate() {
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('candidate', {
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      }, room)
      console.log('ICECandidate found : ', event)
    } else {
      /* there are no more candidates coming during this negotiation */
    }
  }
}

//hangup call for both
endButton.addEventListener('click', () => {
  socket.emit("hangUp", room);
});

socket.on('endCall', function () {
  reInitialize();
  modal.style.display = "block";
  hangup();
  socket.emit("leave", room);
  alert("Call Ended")
})

function hangup() {
  if (peerConnection) {
    console.log('Call Disconnected')
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;

    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    }
    if (localVideo.srcObject) {
      localVideo.srcObject.getTracks().forEach(track => track.stop());
    }

    peerConnection.close();
    peerConnection = null;
  }
}

//start call when button is clicked
formButton.addEventListener('click', () => {
  room = document.getElementById('inputRoom').value
  name = document.getElementById('inputName').value
  if (room !== '') {
    modal.style.display = "none";
    console.log("form submit with room = ", room)
    socket.emit('someOneEntered', room)
    document.getElementById('inputRoom').value = '';
    document.getElementById('inputName').value = '';
  }
  else alert('Room cannot be empty')
});

//reInirialsise for new call
function reInitialize() {
  firstTime = true;
  ismicEnabled = true;
  isCameraEnabled = true;
  isRoomCreator = false;
  micButton.src = "images/micEnabled.png"
  cameraButton.src = "images/cameraEnabled.png"
  console.log('Values REInitialised')
}


//handle event when mic is clicked
function micButtonHandler(event) {
  {
    console.log('Mic Button EventListner working')
    if (ismicEnabled) {
      micButton.src = "images/micDisabled.png"
      localStream.getAudioTracks()[0].enabled = false;
    }
    else {
      micButton.src = "images/micEnabled.png"
      localStream.getAudioTracks()[0].enabled = true;
    }
    ismicEnabled = !ismicEnabled
  }
}

//handle event cam is clicked
function camButtonHandler(event) {

  console.log('Camera Button EventListner working')
  if (isCameraEnabled) {
    cameraButton.src = "images/cameraDisabled.png"
    localStream.getVideoTracks()[0].enabled = false;
  }
  else {
    cameraButton.src = "images/cameraEnabled.png"
    localStream.getVideoTracks()[0].enabled = true;
  }
  isCameraEnabled = !isCameraEnabled
}
