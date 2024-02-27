const mongoose = require('mongoose')

const commentSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    text:String,
    date:{
        type:Date,
        default:Date.now
    },
    replies:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'comment'
        }
    ]   
})


module.exports = mongoose.model('comment', commentSchema)