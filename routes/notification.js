const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    post:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'post'
    },
    seen:{
        type:Boolean,
        default:false
    },
    content:String,
})


module.exports = mongoose.model('notification', notificationSchema)