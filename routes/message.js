const mongoose = require('mongoose')

const messageSchema = mongoose.Schema({
    sender:String,
    receiver:String,
    message:String,
    post:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'post'
    },
    seen:{
        type:Boolean,
        default:false
    },
})


module.exports = mongoose.model('message', messageSchema)