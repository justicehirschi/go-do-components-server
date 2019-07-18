const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

mongoose.connect("mongodb://justice:123456a@ds243728.mlab.com:43728/godo_db", {
    useNewUrlParser: true
});
mongoose.set("useCreateIndex", true);

var userSchema = new mongoose.Schema ({
    first_name: {
        type: String,
        required: [true, "First name is required"]
    },
    last_name: {
        type: String,
        required: [true, "Last name is required"]
    },
    user_name: {
        type: String,
        required: [true, "Username is required"],
        unique: true
    },
    email: {
        type: String,
        required: [true, "Email is required and must be unique"],
        unique: true
    },
    password: {
        type: String,
        required: [true, "Password is required"]
    },
    age: {
        type: String,
        required: [true, "Age is required"]
    },
    city: {
        type: Object,
        required: [true, "City is required"]
    }
});

const profileSchema = new mongoose.Schema ({
    user_name: {
        type: String
    },
    email: {
        type: String
    },
    picture: {
        type: String
    },
    bio: {
        type: String
    },
    attended_events: {
        type: Array
    },
    interests: {
        type: Object
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

const messageSchema = new mongoose.Schema ({
    content: {
        type: String,
        required: [true, "Content is required"]
    },
    date: {
        type: String,
        required: [true, "Date is required"]
    },
    time: {
        type: String,
        required: [true, "Time is required"]
    },
    sending_user: {
        type: String,
        required: [true, "Sending user is required"]
    },
    users: [{
        type: mongoose.Schema.Types.String,
        ref: "User"
    }]
});

const activitySchema = new mongoose.Schema ({
    name: {
        type: String,
        required: [true, "Event name is required"]
    },
    host: {
        type: String,
        required: [true, "Event host is required"]
    },
    place: {
        type: Object,
        required: [true, "Event place is required"]
    },
    age: {
        type: String
    },
    description: {
        type: String,
        required: [true, "Event description is required"]
    },
    main_category: {
        type: String,
        required: [true, "Event main category is required"]
    },
    date: {
        type: String,
        required: [true, "Event date is required"]
    },
    time: {
        type: String,
        required: [true, "Event time is required"]
    },
    message_group: {
        type: Array, // list of user IDs
        required: [true, "Event message group is required"]
    },
    included_categories: {
        type: Array
    },
    attendees: {
        type: Array,
        required: [true, "Event attendees is required"]
    }
});

userSchema.methods.setEncryptedPassword = function(plainPassword, callBackFunction) {
    bcrypt.hash(plainPassword, 10).then(hash => {
        this.password = hash;
        callBackFunction();
    });
};

userSchema.methods.verifyEncryptedPassword = function(plainPassword, callBackFunction) {
    bcrypt.compare(plainPassword, this.password).then(function (valid) {
        callBackFunction(valid);
    });
};

const Users = mongoose.model("User", userSchema);
const Profiles = mongoose.model("Profile", profileSchema);
const Messages = mongoose.model("Message", messageSchema);
const Activities = mongoose.model("Activity", activitySchema);

module.exports = {
    Users: Users,
    Profiles: Profiles,
    Messages: Messages,
    Activities: Activities
}
