var express = require('express');
var router = express.Router();
const userModel = require('./users')
const postModel = require('./posts')
const storyModel = require('./story')
const commentModel = require('./comment')
const messageModel = require('./message')
const notificationModel = require('./notification')
const upload = require('./multer')
const localStrategy = require('passport-local');
const passport = require('passport');
const notification = require('./notification');
passport.use(new localStrategy(userModel.authenticate()))



router.get('/', function (req, res) {
  res.render('index', { footer: false });
});

router.post('/register', function (req, res) {
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email,
  })
  userModel.register(userData, req.body.password)
    .then(function (registeredUser) {
      passport.authenticate('local')(req, res, function () {
        res.redirect('/profile')
      })
    })
});

router.get('/login', function (req, res) {
  res.render('login', { footer: false });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/profile',
  failureRedirect: '/login'
}), function (req, res) {
});

router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

router.get('/edit', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  res.render('edit', { footer: true, loggedUser });
});
router.post('/editprofile', isLoggedIn, upload.single('image'), async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  loggedUser.profileImg = req.file.filename
  await loggedUser.save()
  res.redirect('/edit')
});
router.post('/update', isLoggedIn, async function (req, res) {
  await messageModel.updateMany({receiver: req.session.passport.user},{receiver: req.body.username},{new:true})
  await messageModel.updateMany({sender: req.session.passport.user},{sender: req.body.username},{new:true})
  const loggedUser = await userModel.findOneAndUpdate(
    { username: req.session.passport.user },
    { username: req.body.username, name: req.body.name, bio: req.body.bio },
    { new: true }
  )

  req.login(user, function (err) {
    if (err) throw err;
    res.redirect("/profile");
  });

  res.redirect('/profile')
});
router.get('/upload', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  res.render('upload', { footer: true, loggedUser });
});
router.post('/upload', isLoggedIn, upload.single('image'), async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  if (req.body.category === "post") {

    const post = await postModel.create({
      user: loggedUser._id,
      media: req.file.filename,
      caption: req.body.caption
    })
    loggedUser.posts.push(post._id)
  } else if (req.body.category === "story") {

    const story = await storyModel.create({
      user: loggedUser._id,
      media: req.file.filename,
    })
    loggedUser.stories.push(story._id)
  } else {
    res.send("Waah guru g tumne ye din dikha diye")
  }

  await loggedUser.save();
  res.redirect('/profile')

});

router.get('/feed', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user }).populate('followings messagedUsers notifications')

  let isSeenAllNoti = true;
  let isSeenAllMsg = true;

  if( await notificationModel.findOne({
    toUser:loggedUser._id,
    seen:false
  })) isSeenAllNoti = false;
  
  if( await messageModel.findOne({
    receiver:loggedUser.username,
    seen:false
  })) isSeenAllMsg = false;
  
  


  const allposts = await postModel.find().populate('user')
  const posts = allposts.map(post => ({ ...post.toObject(), duration: timeSpanFromNow(post.date), likes: post.likes.map(id => id.toString()) }))
  const userStories = await storyModel.find({ user: { $ne: loggedUser.id } }).populate('user')
  const uni = {};

  const filtered = userStories.filter(function (story) {
    if (!uni[story.user.id]) {
      uni[story.user.id] = true;
      return true;
    }
    return false;
  })

  let allUsers = []
  if (loggedUser.messagedUsers.length > 0) {
    allUsers = loggedUser.messagedUsers
  } else {
    allUsers = loggedUser.followings
  }

  res.render('feed', { footer: true, loggedUser, allUsers, posts, filteredStoryUsers: filtered, isSeenAllNoti,isSeenAllMsg });
});

router.get('/like/:postId', async function (req, res) {
  const post = await postModel.findOne({ _id: req.params.postId })
  const postUser = await userModel.findOne({ _id: post.user })
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  if (post.likes.indexOf(loggedUser._id) == -1) {
    post.likes.push(loggedUser._id);

    if (!postUser._id.equals(loggedUser._id)) {
      const notification = await notificationModel.create({
        toUser: postUser._id,
        fromUser: loggedUser._id,
        post: post._id,
        content: `${loggedUser.username} liked on your post.`
      })
      postUser.notifications.push(notification._id);
      await postUser.save();
    }

  } else {
    post.likes.splice(post.likes.indexOf(loggedUser._id), 1)
    const deleteNotification = await notificationModel.findOneAndDelete({ post: post._id, content: `${loggedUser.username} liked on your post.` })
    if (deleteNotification) {
      postUser.notifications.splice(postUser.notifications.indexOf(deleteNotification._id), 1)
      await postUser.save();
    }
  }
  await post.save()
  res.json(post)

})
router.get('/save/:postId', async function (req, res) {
  const post = await postModel.findOne({ _id: req.params.postId })
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  if (loggedUser.savedPosts.indexOf(req.params.postId) == -1) {
    loggedUser.savedPosts.push(req.params.postId)
  } else {
    loggedUser.savedPosts.splice(loggedUser.savedPosts.indexOf(req.params.postId), 1)
  }
  await loggedUser.save()

})
router.get('/comment/:postId', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  let post = await postModel.findOne({ _id: req.params.postId }).populate({ path: "comments", populate: [{ path: "user" }, { path: "replies" }] })
  const comments = post.comments.map(comment => ({ ...comment.toObject(), duration: timeSpanFromNow(comment.date) }))
  res.render('comment', { comments, loggedUser, postId: req.params.postId, footer: false });
})

router.post('/comment/:postId', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const post = await postModel.findOne({ _id: req.params.postId })
  const postUser = await userModel.findOne({ _id: post.user })

  const newcomment = await commentModel.create({
    user: loggedUser._id,
    text: req.body.comment,
  })
  if (req.body.type && req.body.type !== 'comment') {
    const comment = await commentModel.findOne({ _id: req.body.type })
    comment.replies.push(newcomment._id);
    await comment.save()

    if (!postUser._id.equals(loggedUser._id)) {
      const notification = await notificationModel.create({
        toUser: postUser._id,
        fromUser: loggedUser._id,
        post: post._id,
        content: `${loggedUser.username} replied '${req.body.comment}' on your post.`
      })
      postUser.notifications.push(notification._id);
      await postUser.save();
    }

  }
  else {
    const post = await postModel.findOne({ _id: req.params.postId })
    post.comments.push(newcomment._id)
    await post.save()

    if (!postUser._id.equals(loggedUser._id)) {
      const notification = await notificationModel.create({
        toUser: postUser._id,
        fromUser: loggedUser._id,
        post: post._id,
        content: `${loggedUser.username} commented '${req.body.comment}' on your post.`
      })
      postUser.notifications.push(notification._id);
      await postUser.save();
    }
  }
  res.redirect('/comment/' + req.params.postId)
})

router.get('/story/:userId', async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const storyUser = await userModel.findOne({ _id: req.params.userId }).populate('stories')

  res.json(storyUser.stories)
})

router.get('/user/:userId/stories', isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.params.userId).populate('stories');
  if (user.stories.length === 0) { res.redirect('/feed') }
  res.render('userStories', { user });
});

router.get('/reply/:commentId', isLoggedIn, async function (req, res, next) {
  const comment = await commentModel.findOne({ _id: req.params.commentId }).populate({ path: "replies", populate: { path: "user" } });
  res.json(comment.replies);
})

router.get('/savedposts', isLoggedIn, async function (req, res, next) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user }).populate("savedPosts");
  res.render('savedpost', { footer: true, loggedUser })
})
router.get('/post/:postId', isLoggedIn, async function (req, res, next) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user }).populate('followings messagedUsers notifications')
  const post = await postModel.findOne({ _id: req.params.postId }).populate('user')
  let allUsers = []
  if (loggedUser.messagedUsers.length > 0) {
    allUsers = loggedUser.messagedUsers
  } else {
    allUsers = loggedUser.followings
  }
  res.render('openpost', { footer: true, loggedUser, post ,allUsers})
})

router.get('/profile', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user }).populate('posts')
  res.render('profile', { footer: true, loggedUser });
});
router.get('/profile/:user', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const user = await userModel.findOne({ username: req.params.user }).populate('posts')
  if (loggedUser._id.equals(user._id)) {
    res.redirect('/profile')
  }
  res.render('userprofile', { footer: true, loggedUser, user });
});


router.get('/follow/:userId', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const user = await userModel.findOne({ _id: req.params.userId })
  if (loggedUser.followings.indexOf(user._id) === -1) {
    loggedUser.followings.push(user._id)
    user.followers.push(loggedUser._id)
    if (!user._id.equals(loggedUser._id)) {
      const notification = await notificationModel.create({
        toUser: user._id,
        fromUser: loggedUser._id,
        content: `${loggedUser.username} started following you.`
      })
      user.notifications.push(notification._id);
    }
  } else {
    loggedUser.followings.splice(loggedUser.followings.indexOf(user._id), 1)
    user.followers.splice(user.followers.indexOf(loggedUser._id), 1)
    const deleteNotification = await notificationModel.findOneAndDelete({ content: `${loggedUser.username} followed you.` })
    if (deleteNotification) {
      user.notifications.splice(user.notifications.indexOf(deleteNotification._id), 1)
      await user.save();
    }

  }
  await loggedUser.save()
  await user.save()

  res.redirect('back');
});

router.get('/search', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  res.render('search', { footer: true, loggedUser });
});
router.get('/search/:user', isLoggedIn, async function (req, res) {
  const regex = new RegExp(`^${req.params.user}`, 'i')
  const users = await userModel.find({ username: { $regex: regex } })
  res.json(users)
});
router.get('/:user/:type/list', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.params.user }).populate(req.params.type);
  const loggedUser = await userModel.findOne({ username: req.session.passport.user }).populate(req.params.type);
  const commonUsers = user[req.params.type].filter(obj => loggedUser.followings.some(item => item._id.equals(obj._id)));
  const uniqueUsers = user[req.params.type].filter(obj => !loggedUser.followings.some(item => item._id.equals(obj._id)));
  res.render('userlist', { footer: true, user, commonUsers, uniqueUsers, loggedUser, type: req.params.type });

})

router.get('/notification', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
    .populate({
      path: 'notifications',
      populate: [
        { path: 'fromUser' },
        { path: 'post', populate: { path: 'user' } }
      ]
    });
  const updatedNotifications = await notificationModel.updateMany({ toUser: loggedUser._id, seen: false }, { $set: { seen: true } })
  res.render('notification', { footer: true, loggedUser });
});

router.get('/clearallnotification', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const deletedData = await notificationModel.deleteMany({ user: loggedUser._id })
  loggedUser.notifications = []
  await loggedUser.save()
  res.redirect('back')
});
router.get('/inbox', isLoggedIn, async function (req, res) {
  let loggedUser = await userModel.findOne({ username: req.session.passport.user })
    .populate('followings messagedUsers')
  let allUsers = []
  if (loggedUser.messagedUsers.length > 0) {
    allUsers = loggedUser.messagedUsers
  } else {
    allUsers = loggedUser.followings
  }
  await messageModel.updateMany({ receiver: loggedUser.username, seen: false }, { $set: { seen: true } })

  res.render('inbox', { footer: false, loggedUser, allUsers });
});

router.get('/message/:username', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const user = await userModel.findOne({ username: req.params.username })
  const chats = await messageModel.find(
    {
      $or: [{
        sender: loggedUser.username,
        receiver: user.username
      }, {
        receiver: loggedUser.username,
        sender: user.username
      }
      ]
    }
  )
    .populate({ path: 'post', populate: { path: 'user' } })

  res.render('chat', { footer: false, loggedUser, user, chats });

});
router.get('/sendpost/:postId/:username', isLoggedIn, async function (req, res) {
  const loggedUser = await userModel.findOne({ username: req.session.passport.user })
  const user = await userModel.findOne({ username: req.params.username })
  const message = await messageModel.create({
    sender: loggedUser.username,
    receiver: user.username,
    post: req.params.postId
  })
  if (loggedUser.messagedUsers.indexOf(user._id) === -1) {
    loggedUser.messagedUsers.push(user._id)
    user.messagedUsers.push(loggedUser._id)
    await user.save()
    await loggedUser.save()
  }
  res.status(200).json("Sent")

});
// router.get('/checkseen/:type',isLoggedIn,function(req, res,next){


// });


function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login')
}

function timeSpanFromNow(inputDate) {
  // Convert inputDate to a Date object
  const inputDateTime = new Date(inputDate);

  // Get the current date and time
  const currentDateTime = new Date();

  // Calculate the time difference in milliseconds
  const timeDifference = currentDateTime - inputDateTime;

  // Calculate days, hours, minutes, seconds, and weeks
  const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);
  const weeks = Math.floor(days / 7);

  // Determine the largest time unit
  if (weeks > 0) {
    return `${weeks}w`;
  } else if (days > 0) {
    return `${days}d`;
  } else if (hours > 0) {
    return `${hours}hr`;
  } else if (minutes > 0) {
    return `${minutes}min`;
  } else {
    return `${seconds}s`;
  }
}


module.exports = router;
