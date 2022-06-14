const os = require('os');//for operating system-related utility methods and properties
const express = require('express');
const hbs = require('hbs');
const path = require('path');
const http = require('http'); //for creating http server
const socketio = require('socket.io');//For signalling in WebRTC

const app = express();
const server = http.createServer(app);

const port = process.env.PORT || 3333;

const publicStaticDirPath = path.join(__dirname, '/public')
const viewsPath = path.join(__dirname ,'/templates/views')
const partialsPath = path.join(__dirname ,'/templates/partials')

app.set('view engine' , 'hbs');
app.set('views', viewsPath); 
hbs.registerPartials(partialsPath);
app.use(express.static(publicStaticDirPath));

app.get('', (req, res) => {
    res.render("index")
})

server.listen(port, ()=>{
    console.log("Server is running on port : ", port)
})

const io = socketio(server);//Initialize socket.io

io.sockets.on('connection', function(socket) {
    console.log("Connceted --> ", socket.id);
   
    socket.on('someOneEntered',function(room){

        //to get count of connected user in room 'room'
        var clientsInRoom = io._nsps.get('/').adapter.rooms.get(room);
	    var numClients = clientsInRoom ? clientsInRoom.size : 0;

        console.log(numClients, " members in room : ", room )

        if(numClients === 0){
            socket.join(room);
            //console.log(socket.id , "Created room = ", room);

            // to individual socketid (private message)
            io.to(socket.id).emit('roomCreated');
        }

        else if(numClients === 1){
            socket.join(room);

            // to individual socketid (private message)
            io.to(socket.id).emit('roomJoined');  
        }

        else{
            io.to(socket.id).emit('roomFull');
            console.log('Room full');
        }

    });

    socket.on('askToCreateOffer', function(room){
        // to all clients in room1
        io.in(room).emit('createOffer');
    })

    socket.on('sendOffer',function(description, room){
        // to all clients in room1
        io.in(room).emit('offerReceived',description);
    })

    socket.on('sendAnswer',function(description, room){
        // to all clients in room1
        io.in(room).emit('answerReceived',description);
    })

    socket.on('candidate',function(candidate,room){
        // to all clients in room1
        io.in(room).emit('candidate',candidate);
    })

    socket.on('hangUp', function(room){
        io.in(room).emit('endCall');

    })

    socket.on('leave',(room)=>{
        socket.leave(room);
    })

});

