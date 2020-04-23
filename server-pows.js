
// Minimal NodeJS + Express server handling user logins and JWT auth tokens

// Load dependencies

const express = require('express');
const bodyParser = require('body-parser');
const argon2 = require('argon2');
const fs = require('fs');
const csurf = require('csurf');
const cookieParser = require('cookie-parser');
const redis = require('redis');
const session = require('express-session')
const RedisStore = require('connect-redis')(session)

// Port the server will listen on

const port = 3003;

// Initialize Express, tell it to automatically parse Content-Type: application/json body data,
// tell it to automatically parse incoming cookie data, and ask it to generate and check CSRF
// tokens.

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

// Use the double submit cookie pattern.

const csrfFilter = csurf({ cookie: true, ignoreMethods: [ 'GET', 'HEAD', 'OPTIONS' ] });

// Apply CSRF checking to all routes (except GET/HEAD/OPTIONS routes)

app.use(csrfFilter);

// Add the XSRF-TOKEN header to all responses

app.all("*", function (req, res, next) {
    res.cookie("XSRF-TOKEN", req.csrfToken());
    next();
});

// Give a nice error message when CSRF token checking fails

app.use(function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403);
    res.send('Error: invalid CSRF token');
});

// Ask Express to serve static resources from the public/ subdirectory.

app.use(express.static('public'));

// Set up Express sessions

const redisClient = redis.createClient();

app.use(
    session({
        store: new RedisStore({ client: redisClient }),
        secret: 'keyboard cat',
        resave: false,
        saveUninitialized: true
    })
);

// A hard-coded sample user database using argon2 for password hashing

const users = [{
    username: 'cnamprem',
    password: 'secret123',
    passwordHash: '',
    secret: 'The answer to the ultimate question of life, the universe and everything is 42'
}];
users.forEach(function (userObj) {
    argon2.hash(userObj.password).then(function (hash) {
        userObj.passwordHash = hash;
        delete userObj.password;
        console.log('User', userObj.username, 'has password hash', userObj.passwordHash);
    });
});

// POST /login handler. Verify the username and password, and if successful, set username in session

app.post('/login', csrfFilter, function (req, res) {
    console.log('Got login request with body', req.body);
    if (req.body && req.body.username && req.body.password) {
        const matchingUsers = users.filter(obj => { return obj.username === req.body.username });
        if (matchingUsers.length === 0) {
            console.log('Got POST /login for username not found in user database');
            res.sendStatus(400);
        } else {
            const userObj = matchingUsers[0];
            argon2.verify(userObj.passwordHash, req.body.password).then((success) => {
                if (success) {
                    console.log('Successful hash verification');
                    req.session.username = userObj.username;
                    res.send({ username: userObj.username });
                } else {
                    console.log('Bad password for user', userObj.username);
                    res.sendStatus(400);
                }
            }).catch((error) => {
                console.log('Unexpected error validating hash:', error);
                res.sendStatus(500);
            });
        }
    } else {
        console.log('Got POST /login without username and password in body');
        res.sendStatus(400);
    }
});

// POST /logout handler

app.post('/logout', function (req, res) {
    if (req.session.username) {
        req.session.username = null;
        res.sendStatus(200);
    } else {
        res.sendStatus(400);
    }
});

// Function to look up the secret stored in the user "database" for username

function userSecret(username) {
    const matchingUsers = users.filter(obj => { return obj.username === username });
    if (matchingUsers.length > 0) {
        return matchingUsers[0].secret;
    }
    return null;
}

// GET /secret handler. checkToken() filter is used to ensure the request is authentic.

app.get('/secret', function (req, res) {
    if (!req.session.username) {
        // Unauthorized access
        res.sendStatus(401);
    } else {
        const secret = userSecret(req.session.username);
        if (secret) {
            // OK
            res.send({ username: req.username, secret: secret });
        } else {
            // Not found
            res.sendStatus(404);
        }
    }
});

// Listen for incoming requests from clients

app.listen(port, () => console.log(`Listening at http://localhost:${port}`));
