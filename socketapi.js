const io = require("socket.io")();
const userModel = require("./routes/users")
const messageModel = require("./routes/message")
const socketapi = {
    io: io
};

// Add your socket.io logic here!
io.on("connection", function (socket) {
    console.log("A user connected");
    socket.on("join-server", async username => {
        const user = await userModel.findOneAndUpdate(
            { username },
            { socketId: socket.id }
        )
    })
    socket.on("send-private-message", async messageObject => {
        const receiver = await userModel.findOne({ username: messageObject.receiver })
        const message = await messageModel.create(messageObject)
        const user = await userModel.findOne({ username: messageObject.sender })
        if (user.messagedUsers.indexOf(receiver._id) === -1) {
            user.messagedUsers.push(receiver._id)
            receiver.messagedUsers.push(user._id)
            await receiver.save()
            await user.save()
        }


        socket.to(receiver.socketId).emit("receive-private-message", messageObject)

    })

});
// end of socket.io logic

module.exports = socketapi;