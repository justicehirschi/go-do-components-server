const bodyParser = require("body-parser");
const express = require("express");
const passport = require("passport");
const passportLocal = require("passport-local");
const session = require("express-session");
const WebSocket = require("ws");
const model = require("./model.js");

var server = express();
server.use(express.json());
server.use(bodyParser.urlencoded({ extended: false }));
server.use(function(request, response, next) {
    response.header("Access-Control-Allow-Origin", request.get("origin"));
    response.header("Access-Control-Allow-Credentials", "true");
    next();
});

server.options("*", function(request, response, next) {
    response.header("Access-Control-Allow-Headers", "Content-Type");
    response.header("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS");
    next();
});

server.set("port", (process.env.PORT || 8000));

server.use(session({secret: "1823mfdsaiewq", resave: false, saveUninitialized: true}));
server.use(passport.initialize());
server.use(passport.session());

passport.serializeUser(function (user, done) {
    done(null, user._id);

});

passport.deserializeUser(function (id, done) {
    model.Users.findOne({
        _id: id
    }).then(function (user) {
        done(null, user);
    }, function (error) {
        done(error);
    });
});

passport.use(new passportLocal.Strategy({
    usernameField: "email",
    passwordField: "plainPassword"
}, function (email, plainPassword, done) {
    model.Users.findOne({
        email: email
    }).then(function (user) {
        if (!user) {
            // failed
            return done(null, false);
        }
        user.verifyEncryptedPassword(plainPassword, function (valid) {
            if (valid) {
                //successful
                return done(null, user);
            } else {
                //failed
                return done(null, false);
            }
        });
    }, function (error) {
        done(error);
    });
}));

// Profile Endpoints

// List Profiles

server.get("/profiles", function(request, response) {
    model.Profiles.find().then(function (data) {
        response.json({
            profiles: data
        });
    }).catch(function (error) {
        response.status(400).json({msg: error.message});
    });
});

// Retrieve profile

server.get("/profiles/:user_name", function(request, response){
    model.Profiles.findOne({'user_name' : request.params.user_name}).then(function(profile){
        if (profile == null){
            response.status(404);
            response.json({msg: `There is no profile with the username of ${request.params.user_name}`});
        } else {
            response.json({profile: profile});
        }
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});

// Create Profile

server.post("/profiles", function(request, response) {
    model.Profiles.create({
        user_name: request.body.user_name,
        picture: request.body.picture,
        bio: request.body.bio,
        attended_events: request.body.attended_events,
        interests: request.body.interests
    }).then(function (new_profile) {
        response.status(201);
        response.json({new_profile: new_profile});
    }).catch(function (error) {
        response.status(400).json({msg: error.message});
    });
});

server.put("/profiles/:user_name", function(request, response){
    model.Profiles.findOne({'user_name' : request.params.user_name}).then(function(profile){
        if (profile == null){
            response.status(404);
            response.json({msg: `There is no profile with the user_name of ${request.params.user_name}`});
        } else {
            if (request.body.profile.user_name != undefined){
                profile.user_name = request.body.profile.user_name;
                profile.picture = request.body.profile.picture;
                profile.bio = request.body.profile.bio;
                profile.attended_events = request.body.profile.attended_events;
                profile.interests = request.body.profile.interests;
                profile.save().then(function(){
                    response.status(200);
                    response.json({profile:profile});
                });
            }
        }
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});


//Activity endpoints

// List Activities

server.get("/activities", function(request, response){
    model.Activities.find().then(function(data){
        response.json({
            activities: data
        });
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    })
});

// Retrieve Activity

server.get("/activities/:id", function(request, response){
    model.Activities.findById(request.params.id).then(function(activity){
        if (activity == null){
            response.status(404);
            response.json({msg: `There is no event with the id of ${request.params.id}`});
        } else {
            response.json({activity: activity});
        }
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});

// Create Activity

server.post("/activities", function(request, response){
    model.Activities.create({
        name: request.body.name,
        host: request.body.host,
        place: request.body.place,
        age: request.body.age,
        description: request.body.description,
        main_category: request.body.main_category,
        date: request.body.date,
        time: request.body.time,
        message_group: request.body.message_group,
        included_categories: request.body.included_categories,
        attendees: request.body.attendees
    }).then(function(new_activity){
        response.status(201);
        response.json({new_activity: new_activity});
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});

// Delete Activity

server.delete("/activities/:id", function(request, response){
    model.Activities.findByIdAndDelete(request.params.id).then(function(){
        response.status(204);
        response.send();
    }).catch(function(error){
        console.log(error.message);
        response.status(400).json({msg: error.message});
    });
});

// Add attendee to an activity
server.put("/activities/:id/add_attendee", function(request, response){
    model.Activities.findById(request.params.id).then(function(activity){
        if (activity == null){
            response.status(404);
            response.json({msg: `There is no event with the id of ${request.params.id}`});
        } else {
            for(var attendee in activity.attendees) {
                if(activity.attendees[attendee] == request.body.user_name) {
                    response.status(400).json({msg: "You have already joined this event"});
                    return;
                }
            }
            activity.attendees.push(request.body.user_name)
            activity.save().then(function(){
                response.status(200).json({activity: activity});
                sendAllEventsToAllSockets();
            });
        }
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});

//List messages

server.get("/messages", function (request, response) {
    if(!request.user) {
        response.sendStatus(401);
        return;
    }
    model.Messages.find({}).then(function (messages) {
        response.json(messages);
    });
});

// Create Message

server.post("/messages", function (request, response) {
    console.log("Body:", request.body);

    let message = new model.Messages({
        content: request.body.content,
        date: request.body.date,
        time: request.body.time,
        sending_user: request.body.sending_user,
        users: request.body.users
    });

    message.save().then(function () {
        response.sendStatus(201);
        sendAllMessagesToAllSockets();
    }, function(err) {
        if(err.errors) {
            var errorMessages = {};
            for(var e in err.errors) {
                errorMessages[e] = err.errors[e].errorMessages;
            }

            console.log("Error Saving Message", errorMessages);
            response.status(422).json(errorMessages);
        } else {
            console.log("Unexpected Error Saving Message");
            response.sendStatus(500);
        }
    });
});


// Session Enpoints

// Get Session

server.get("/session", function(request, response) {
    if(request.user) {
        // Logged In
        response.sendStatus(200);
    } else {
        // Not Logged In
        response.sendStatus(401);
    }
});

server.post("/session", passport.authenticate("local"), function (request, response) {
    response.sendStatus(201);
});

server.delete("/logout", function(request, response) {
    if(request.user) {
        request.logout();
        response.sendStatus(200);
    } else {
        response.sendStatus(403);
    }
});


//Users endpoints

//create user
server.post("/users", function(request, response){
    let user = model.Users({
        first_name: request.body.first_name,
        last_name: request.body.last_name,
        user_name: request.body.user_name,
        email: request.body.email,
        age: request.body.age,
        city: request.body.city,
        messages: request.body.messages,
        user_chats: request.body.user_chats
    });

    user.setEncryptedPassword(request.body.password, function() {
        user.save().then(function(){
            response.sendStatus(201);
        }, function(error){
            if (error.errors) {
                var messages = {};
                for (var e in error.errors){
                    messages[e] = error.errors[e].message;
                }

                console.log("Error Saving User.", messages);
                response.status(422).json(messages);
            } else if (error.code == 11000){
                response.status(422).json({
                    email: "That email is already in use"
                });
            } else {
                console.log("Unexpected Error saving User");
                response.sendStatus(500);
            }
        });
    });
});

//get users user_name
server.get("/users/user_name", (request, response) => {
    if (!request.user) {
        response.sendStatus(401);
        return;
    }
    response.json(request.user.user_name);
});

//get users city
server.get("/users/city", (request, response) => {
    if (!request.user) {
        response.sendStatus(401);
        return;
    }
    response.json(request.user.city);
});

//get users messages
server.get("/users/messages", (request, response) => {
    if(!request.user) {
        response.sendStatus(401);
        return;
    }
    response.json(request.user.messages);
});

//get users user_chats
server.get("/users/user_chats", (request, response) => {
    if (!request.user) {
        response.sendStatus(401);
        return;
    }
    response.json(request.user.users_chats);
});

//get user by user_name
server.get("/users/:user_name", function(request, response){
    if (!request.user){
        response.sendStatus(401);
        return;
    } else {
        model.Users.findOne({ 'user_name': request.params.user_name}).then(function(user){
            if (user == null){
                response.status(404);
                response.json({msg: `There is no user with the username of ${request.params.user_name}`});
            } else {
                response.json({user: user});
            }
        }).catch(function(error){
            response.status(400).json({msg: error.message});
        });
    }
});

//delete user by id (needs to be changed to by user_name)
server.delete("/users/:id", function(request, response){
    model.Users.findByIdAndDelete(request.params.id).then(function(){
        response.status(204);
        response.send();
    }).catch(function(error){
        response.status(400).json({msg: error.message});
    });
});

//edit user by user_name
server.put("/users/:user_name", function(request, response) {
    if(!request.user) {
        response.sendStatus(401);
        return;
    }  
    model.Users.findOne({'user_name': request.params.user_name}).then(function(user) {
        if(user == "null") {
            response.sendStatus(404);
            response.json({msg: `There is no user with the user_name of ${request.params.user_name}`});
        } else {
            user.first_name = request.body.user.first_name;
            user.last_name = request.body.user.last_name;
            user.email = request.body.user.email;
            user.age = request.body.user.age;
            user.city = request.body.user.city;
            user.messages = request.body.user.messages;
            user.user_chats = request.body.user.chats;

            if(request.body.user.password != "") {
                user.setEncryptedPassword(request.body.user.password, function () {
                    user.save().then(function () {
                        response.sendStatus(200);
                    }, function (error) {
                        if (error.errors) {
                            var messages = {};
                            for (var e in error.errors) {
                                messages[e] = error.errors[e].message;
                            }
    
                            console.log("Error Editing User.", messages);
                            response.status(422).json(messages);
                        } else {
                            console.log("Unexpected Error saving User");
                            response.sendStatus(500);
                        }
                    });
                });
            } else {
                user.save().then(function () {
                    response.sendStatus(200);
                });
            }
        }
    });
});

// edit user messages by user_name
server.put("/users/:user_name/messages", function (request, response) {
    if (!request.user) {
        response.sendStatus(401);
        return;
    }
    model.Users.findOne({'user_name': request.params.user_name}).then(function (user) {
        if (user == "null") {
            response.sendStatus(404);
            response.json({
                msg: `There is no user with the user_name of ${request.params.user_name}`
            });
        } else {
            console.log(request.body.receiving_chat_users);
            user.users_chats.push(request.body.receiving_chat_users);
            user.messages.push(request.body.new_message);
            user.save().then(function () {
                response.sendStatus(200);
                sendAllMessagesToAllSockets(request.params.user_name);
            }, function (error) {
                if (error.errors) {
                    var messages = {};
                    for (var e in error.errors) {
                        messages[e] = error.errors[e].message;
                    }

                    console.log("Error Editing User.", messages);
                    response.status(422).json(messages);
                } else {
                    console.log("Unexpected Error saving User");
                    response.sendStatus(500);
                }
            });
        }
    });
});

// edit users chats by user_name
server.put("/users/:user_name/users_chats", function (request, response) {
    if (!request.user) {
        response.sendStatus(401);
        return;
    }
    model.Users.findOne({
        'user_name': request.params.user_name
    }).then(function (user) {
        if (user == "null") {
            response.sendStatus(404);
            response.json({
                msg: `There is no user with the user_name of ${request.params.user_name}`
            });
        } else {
            for(i = 0; i < user.users_chats.length; i++) {
                if(user.users_chats[i] == request.body.receiving_chat_user) {
                    response.status(400).json({msg: "Already in a chat with that user"});
                }
            }
            user.users_chats.push(request.body.receiving_chat_user);
            user.save().then(function () {
                response.sendStatus(200);
            }, function (error) {
                if (error.errors) {
                    var messages = {};
                    for (var e in error.errors) {
                        messages[e] = error.errors[e].message;
                    }

                    console.log("Error Editing User.", messages);
                    response.status(422).json(messages);
                } else {
                    console.log("Unexpected Error saving User");
                    response.sendStatus(500);
                }
            });
        }
    });
});


var serverToWebSockets = server.listen(server.get("port"), function () {
    console.log("Listening...");
});

////////////// Web Sockets /////////////////

const wss = new WebSocket.Server({ server: serverToWebSockets });

var broadcastToAllSockets = function(data) {
    wss.clients.forEach(function (client) {
        if(client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
};

var sendAllMessagesToAllSockets = function(user_name) {
    model.Users.findOne({'user_name': user_name}).then(function (user) {
        let data = {
            resource: "message",
            action: "list",
            data: user.messages
        };
        broadcastToAllSockets(data);
    });
};

var sendAllEventsToAllSockets = function() {
    model.Activities.find().then(function (activities) {
        let data = {
            resource: "attendee",
            action: "list",
            data: activities
        }
        broadcastToAllSockets(data);
    });
};

wss.on("connection", function connection(ws) {
    ws.on("message", function incoming(data) {
        data = JSON.parse(data);
        console.log("DATA received from client:", data);

        if(data.action == "list" && data.resource == "message") {
            // Send list of messages
            model.Messages.findOne({'user_name': data.user_name}).then(function (user) {
                let data = {
                    resource: "message",
                    action: "list",
                    data: user.messages
                };
                ws.send(JSON.stringify(data));
            });
        }
        if(data.action == "list" && data.resource == "attendee") {
            // Send list of events
            model.Activities.find().then(function(activities) {
                let data = {
                    resource: "attendee",
                    action: "list",
                    data: activities
                }
                ws.send(JSON.stringify(data));
            });
        }
        // if(data.action == "delete" && data.resource == "message") {
        //     model.Messages.find({}).then(function (messages) {
        //         let data = {
        //             resource: "message",
        //             action: "deleteAll",
        //             data: messages
        //         };
        //         ws.send(JSON.stringify(data));
        //     });
        // }
    });
});
