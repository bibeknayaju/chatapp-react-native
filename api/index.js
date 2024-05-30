const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const crypto = require("crypto");
const passport = require("passport");
const LocalStragtegy = require("passport-local").Strategy;
const multer = require("multer");

const app = express();
const port = 8000;
const cors = require("cors");

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());

const User = require("./models/user");
const Message = require("./models/message");

const jwt = require("jsonwebtoken");

mongoose
  .connect(
    "mongodb+srv://bibeknayaju:bibek@cluster0.fjymf3y.mongodb.net/?retryWrites=true&w=majority",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("CONNECTED TO MONGODB");
  })
  .catch((error) => {
    console.log("ERROR RIGHT MONGODB CONNECTION", error);
  });

// endpoint for the user registration
app.post("/register", async (req, res) => {
  try {
    const { email, name, password, image } = req.body;

    // cheking already if the user is created or not
    const exisitingUser = await User.findOne({ email });
    if (exisitingUser) {
      return res.status(400).json({ message: "user already exists brother" });
    }

    // create a new user
    const newUser = new User({ name, email, password, image });

    // save the user
    await newUser
      .save()
      .then(() => {
        res.status(200).json({ message: "user registered successfully" });
      })
      .catch((error) => {
        console.log(error);
      });
  } catch (error) {
    console.log("error hai ta guys", error);
    res.status(500).json({ message: "error aayo yr registratin ma" });
  }
});

//function to create a token for the user
const createToken = (userId) => {
  // Set the token payload
  const payload = {
    userId: userId,
  };

  // Generate the token with a secret key and expiration time
  const token = jwt.sign(payload, "Q$r2K6W8n!jCW%Zk", { expiresIn: "1h" });

  return token;
};

//endpoint for logging in of that particular user
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  //check if the email and password are provided
  if (!email || !password) {
    return res
      .status(404)
      .json({ message: "Email and the password are required" });
  }

  //check for that user in the database
  User.findOne({ email })
    .then((user) => {
      if (!user) {
        //user not found
        return res.status(404).json({ message: "User not found" });
      }

      //compare the provided passwords with the password in the database
      if (user.password !== password) {
        return res.status(404).json({ message: "Invalid Password!" });
      }

      const token = createToken(user._id);
      res.status(200).json({ token });
    })
    .catch((error) => {
      console.log("error in finding the user", error);
      res.status(500).json({ message: "Internal server Error!" });
    });
});

//endpoint to access all the users except the logged in the user
// this is getting all the user except the logged in user
app.get("/users/:userId", (req, res) => {
  try {
    const loggedInUserId = req.params.userId;

    User.find({ _id: { $ne: loggedInUserId } })
      .then((users) => {
        res.status(200).json(users);
      })
      .catch((error) => {
        console.log("Error: ", error);
        res.status(500).json("errror");
      });
  } catch (error) {
    res.status(500).json({ message: "error getting the users" });
  }
});

// endpoint to send a request to a user
app.post("/friend-request", async (req, res) => {
  try {
    const { currentUserId, selectedUserId } = req.body;

    // update the receipent's friendRequests
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { friendRequests: currentUserId },
    });

    // update the currentUserId sendfriendrequest
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFriendRequests: selectedUserId },
    });

    res.status(200);
  } catch (error) {
    console.log("error in the sending the friend request", error.message);
    res
      .status(500)
      .json({ message: "error in the seding the friend requests" });
  }
});

// endpoint to show all the friend requests of a particular user
app.get("/friend-request/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // fetch the user document based on the user id
    const user = await User.findById(userId)
      .populate("friendRequests", "name email image")
      .lean();

    const friendRequests = user.friendRequests;

    res.status(200).json(friendRequests);
  } catch (error) {
    console.log("error in the feching the friend request mate", error);
  }
});

// endpoint to accept the friend request of a particular user
app.post("/friend-request/accept", async (req, res) => {
  try {
    const { senderId, receiptId } = req.body;

    // retrieve the sender and receipt details
    const sender = await User.findById(senderId);
    const receipt = await User.findById(receiptId);

    sender.friends.push(receiptId);
    receipt.friends.push(senderId);

    receipt.friendRequests = receipt.friendRequests.filter(
      (request) => request.toString() !== senderId.toString()
    );

    sender.sentFriendRequests = sender.sentFriendRequests.filter(
      (request) => request.toString() !== receiptId.toString()
    );

    await sender.save();
    await receipt.save();

    res.status(200).json({ message: "friend request accepted successfully" });
  } catch (error) {
    console.log("error in accepting the user");
    res.status(500).json({ message: "internal error occured" });
  }
});

// for getting all the accepted user of the particular user
app.get("/accepted-friends/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "friends",
      "name email image"
    );

    const acceptedUsers = user.friends;

    res.status(200).json(acceptedUsers);
  } catch (error) {
    console.log("error in getting the accepted friends", error);
    res
      .status(500)
      .json({ message: "error in getting al the accepted friends" });
  }
});

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "files/"); // Specify the desired destination folder
  },
  filename: function (req, file, cb) {
    // Generate a unique filename for the uploaded file
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// end point to send the message and store in db
app.post("/message", upload.single("imageFile"), async (req, res) => {
  try {
    const { senderId, recepientId, messageType, messageText } = req.body;

    const newMessage = new Message({
      senderId,
      recepientId,
      messageType,
      message: messageText,
      timeStamp: Date.now(),
      imageUrl: messageType === "image" ? req.file.path : null,
    });
    await newMessage.save();
    res.status(200).json({ message: "message sent successfully" });
  } catch (error) {
    console.log("Error in sending message", error);
    res.status(500).json({ message: "internal server error brother " });
  }
});

///endpoint to get the userDetails to design the chat Room header
app.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    //fetch the user data from the user ID
    const recepientId = await User.findById(userId);

    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//endpoint to fetch the messages between two users in the chatRoom
app.get("/messages/:senderId/:recepientId", async (req, res) => {
  try {
    const { senderId, recepientId } = req.params;

    const messages = await Message.find({
      $or: [
        { senderId: senderId, recepientId: recepientId },
        { senderId: recepientId, recepientId: senderId },
      ],
    }).populate("senderId", "_id name");

    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// for message deletion endpoint
app.post("/delete/messages", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "invalid req body" });
    }

    await Message.deleteMany({ _id: { $in: messages } });

    res.status(200).json({ message: "message deleted successfully" });
  } catch (error) {
    console.log("error in the deleting the messages");
    res.status(500).json({ message: "error in the deleting the messages" });
  }
});

app.get("/friend-requests/sent/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate("sentFriendRequests", "name email image")
      .lean();

    const sentFriendRequests = user.sentFriendRequests;

    res.json(sentFriendRequests);
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ error: "Internal Server" });
  }
});

app.get("/friends/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    User.findById(userId)
      .populate("friends")
      .then((user) => {
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        const friendIds = user.friends.map((friend) => friend._id);

        res.status(200).json(friendIds);
      });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({ message: "internal server error" });
  }
});

// for getting th user details
app.get("/profile/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: "Error while getting the profile" });
  }
});

app.listen(port, () => {
  console.log(`localhost:${port}`);
});
