const mongoose = require('mongoose')
const plm = require('passport-local-mongoose')

mongoose.connect('mongodb://127.0.0.1:27017/instaclone')

const userSchema = mongoose.Schema({
  username: String,
  password: String,
  name: String,
  email: String,
  socketId: String,
  bio: {
    type: String,
    default: "Not bio yet(click edit profile to set)."
  },
  profileImg: {
    type: String,
    default: 'def.jpg'
  },
  posts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'post'
    }
  ],
  savedPosts: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'post'
    }
  ],
  followings: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    }
  ],
  followers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user'
    }
  ],
  stories: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'story'
    }
  ],
  notifications: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'notification'
    }
  ],
  messagedUsers:[
    {
      type:mongoose.Schema.Types.ObjectId,
      ref:'user'
    }
  ]
})

userSchema.plugin(plm)

module.exports = mongoose.model('user', userSchema)