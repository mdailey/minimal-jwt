
# Minimal JWT Example, Flaws, and Fixes

This an example of a minimal Node application using
JWT, a quick examination of its limitations and flaws,
and a couple alternatives that address those flaws.

## A basic single page application using JWTs for authentication

### NodeJS installation

    $ sudo apt install curl software-properties-common
    $ curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
    $ sudo apt install nodejs
    
### Project initialization

In the directory that's going to contain your project, run

    $ npm init
    $ npm install --save express
    
You can accept the defaults. This creates an initial
<tt>package.json</tt> file that describes your new
package and its dependencies.

## Initial program

Create a file <tt>index.js</tt> in the same directory.
Give it the following initial contents:

    const express = require('express');
    const app = express();
    const port = 3003;
    
    app.get('/', (req, res) => res.send('Hello World!'));
    
    app.listen(port, () => console.log(`Listening at http://localhost:${port}`));

Start the server with

    $ nodejs index.js
    
Try loading this in the browser. You should see the hello world
message.

### HTML template

Next let's change the code so that we can serve
a static HTML template.

Replace the <tt>app.get()</tt> call for <tt>/</tt>
with the code

    app.use(express.static('public'));
    
Then create a file <tt>public/index.html</tt> with contents

    <html lang="en">
    <head>
        <title>Minimal JWT Example</title>
    </head>
    <body>
    <div id="login-div">
        <h1>Login</h1>
        <label for="username">Enter username: </label>
        <input id="username" name="username">
        <label for="password">Enter password:</label>
        <input id="password" type="password">
    </div>
    <div id="secret-div" style="display: none">
        <h1>The Secret</h1>
        <p>The secret is: <span id="secret"></span></p>
    </div>
    </body>
    </html>

The HTML should be accessible at
[http://localhost:3003/index.html](http://localhost:3003/index.html)
once you restart the server.

### Client-side JavaScript

So far we have server-side JavaScript and client-side HTML.
Let's add some client-side JavaScript to the mix.
Create a file <tt>public/client.js</tt>
with content as follows:

    alert('Hello, World!');

To load this script in the client, add the tag

    <script src="index.js"></script>

To the body of your HTML template. Now you should see the
alert dialog when you reload the page.

### Attach event listener to the login button

Next, let's add an event listener to the login button
that will send an Ajax request to the server to log in.

On the server side, we'll need a couple modifications.
In order to parse JSON strings in the body of the HTTP
request, install the <tt>body-parse</tt> package: 

    $ npm install --save body-parser
    
then in the server script, set up parsing of JSON body
strings:

    const bodyParser = require('body-parser');
    ...
    // Before your routes, after Express app is instantiated:
    app.use(bodyParser.json())

Next, add the following to your server script to
respond to a <tt>/login</tt> request:

    app.post('/login', function (req, res) {
        console.log('Got login request with body', req.body);
        if (req.body && req.body.username && req.body.password) {
            res.send({ message: 'Hello!' });
        } else {
            res.sendStatus(400);
        }
    });

We're not authenticating yet! We're just collecting the
values submitted from the client and responding appropriately.

Next, client side. Add a couple elements to show login results
above the <tt>button</tt> element in your HTML:

    <p id="login-error" style="color: red"></p>
    <p id="login-result" style="color: green"></p>

Now change the client-side JavaScript to the following
contents:

    window.onload = function () {
        document.getElementById('login-button').addEventListener('click', function () {
            const username = document.getElementById('username').value
            const password = document.getElementById('password').value
            const body = JSON.stringify({ username: username, password: password });
            const httpReq = new XMLHttpRequest();
            httpReq.onreadystatechange = function () {
                if (this.readyState === 4 && this.status === 200) {
                    document.getElementById('login-error').innerHTML = '';
                    document.getElementById('login-result').innerHTML = `Login request succeeded with response ${this.responseText}`;
                } else if (this.readyState === 4) {
                    document.getElementById('login-error').innerHTML = `Server responded with error code ${this.status}`;
                    document.getElementById('login-result').innerHTML = '';
                }
            };
            httpReq.open('POST', '/login', true);
            httpReq.setRequestHeader('Content-Type', 'application/json');
            httpReq.send(body);
        });
    }

We create a function to be executed once the DOM is loaded.
The function adds a click listener to our login button.
The click listener, when invoked by a button press,
grabs the username and password from the input elements,
creates a JSON request body, then does an Ajax HTTP POST
to the <tt>/login</tt> route we just created in
Express.

If successful, you should see an error or success message
depending on what the server did when getting the request.

### Password authentication

OK! Now, on the server, we'd like to perform the
password authentication and generate the user's token.

In a real application, we'd have a user database
containing the username and salted/hashed password.
Here we'll just hardcode the user database as a JSON
array. We'll use the <tt>argon2</tt> library for the
password hash:

    $ npm install --save argon2
    
(you might need a <tt>sudo apt install build-essentials</tt>
for this to work if npm has to compile some C/C++ code!)

In the server script, add this code:

    const argon2 = require('argon2');
    ...
    const users = [{ username: 'cnamprem', password: 'secret123', passwordHash: '' }];
    users.forEach(function (userObj) {
        argon2.hash(userObj.password).then(function (hash) {
            userObj.passwordHash = hash;
            delete userObj.password;
            console.log('User', userObj.username, 'has password hash', userObj.passwordHash);
        });
    });
    ...
    app.post('/login', function (req, res) {
        console.log('Got login request with body', req.body);
        if (req.body && req.body.username && req.body.password) {
            const matchingUsers = users.filter(obj => { return obj.username === req.body.username });
            if (matchingUsers.length == 0) {
                console.log('Got POST /login for username not found in user database');
                res.sendStatus(400);
            } else {
                const userObj = matchingUsers[0];
                argon2.verify(userObj.passwordHash, req.body.password).then((success) => {
                    if (success) {
                        console.log('Successful hash verification');
                        res.send({ message: 'Success!' });
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
          
There are a few points to note here:

- We are creating a hard-coded in-memory user database,
  initially with clear passwords. We use the <tt>argon2</tt>
  library to create the hash for each user's password then
  clear the cleartext password to simulate what the user
  registration might do.
  
- The <tt>argon2</tt> library does the hashing asynchronously.
  The hash function itself returns a JavaScript Promise object
  that resolves to the hash of the input string at a later
  point in time. Thus the <tt>.then(() => { code })</tt>
  syntax.

- The code executed on <tt>POST /login</tt> looks up the
  user data and if found tries to verify the submitted
  password against the hash stored in the database.
  The <tt>argon2</tt> verify function is also asynchronous,
  returning a Promise that resolves to <tt>true</tt> or
  <tt>false</tt> depending on whether the password and hash
  match.

- The rest of the code is trying to send a reasonable
  HTTP response in each error condition (bad request or
  server error depending on the situation).

That's it; no modifications are needed for the client yet.
See if you get a good response when the username/password
are correct and an error response otherwise.

### Generate the JWT

Next we'll generate the JSON Web Token representing the user's
valid authentication.

    $ npm install --save jsonwebtoken
    
In the server script, add

    const jwt = require('jsonwebtoken');
    ...
    function generateJwt(username) {
        return jwt.sign({
            username: username,
            exp: new Date().valueOf() + (1000 * 60 * 60 * 6) // 6 hours
        }, jwtPrivateKey, { algorithm: 'RS256' });
    }

Then replace the existing line in the <tt>POST /login</tt>
callback

    res.send({ message: 'Success!' });

with the line

    res.send({
        username: userObj.username,
        token: generateJwt(userObj.username)
    });

The client code should receive and display the response object
without any changes.

### Client storing of JWT and navigation within the SPA

Once the client has successfully logged in, it should store
the username and token information and use it for later
requests. For those later requests, we need views other than
the login page. So let's make some minimal infrastructure for
routing between different views within the SPA. At the
beginning of <tt>public/client.js</tt>, before the
<tt>window.onload</tt> callback definition, add this code:

    let currentRoute = '/login';
    
    window.addEventListener('popstate', function (event) {
        changeRoute(event.state);
    });

At the beginning of the <tt>window.onload</tt> callback,
add this code:

    changeRoute('/login');
    
Then, in the login success snippet that currently displays
the <tt>responseText</tt> from the Ajax <tt>POST /login</tt>
call, replace with the following code:

    storeToken(JSON.parse(this.responseText));
    changeRoute('/secret');

Now we just need to define the <tt>changeRoute()</tt> and
<tt>storeToken()</tt> functions. You can put them at the
end of the script or anywhere you like:

    function storeToken(loginResponse) {
        sessionStorage.setItem('username', loginResponse.username);
        sessionStorage.setItem('token', loginResponse.token);
    }
    
    function clearLogin() {
        document.getElementById('login-error').innerHTML = '';
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('login-result').innerHTML = '';
    }
    
    function changeRoute(uri) {
        switch(uri) {
            case '/login':
                document.getElementById('secret-div').style.display = 'none';
                document.getElementById('login-div').style.display = 'block';
                window.history.pushState(currentRoute, 'Minimal JWT - Login', '/login');
                break;
            case '/secret':
                document.getElementById('secret-div').style.display = 'block';
                document.getElementById('login-div').style.display = 'none';
                clearLogin();
                window.history.pushState(currentRoute, 'Minimal JWT - Secret', '/secret');
                break;
            default:
                throw new Error('Unknown route');
        }
        currentRoute = uri;
    }

We've added a function <tt>clearLogin()</tt> to clear out
the login form when we navigate away from the login route.

Now, after a login, the browser should display the
"Secret" view, and if you use the dev tools to examine
the browser's session storage for
<tt>http:\/\/localhost:3003</tt>, you should see the
username and token.

### Use the stored JWT to authenticate subsequent requests

Now we'd like to submit a request for some sensitive data
from the server using our JWT to provide necessary
authentication information to allow the request.

On the client side, add an error element and
some buttons to the secret view:

    <p>The secret is: <span id="secret" style="color: green"></span></p>
    <p id="error" style="color: red"></p>
    <button id="fetch-secret-button">Fetch secret</button>
    <br>
    <button id="logout-button">Log out</button>

Then we add click handlers. Logout is simple if we mean just
clearing the client session state. A more complete solution
would add an Ajax call such as "logout" that would revoke
the token on the server.

Note that
like the login handler, the calls to set up these callbacks
need to be in the <tt>window.onload</tt> callback to ensure
the DOM is set up before we attach the handlers.

    window.onload = function () {
        ...
        document.getElementById('logout-button').addEventListener('click', function () {
            clearToken();
            changeRoute('/login');
        });
    }

    function clearToken() {
        sessionStorage.clear();
    }

For the secret fetching button, we make an Ajax request, attaching
the authentication token. Let's abstract that capability into a
function we can reuse:

    window.onload = function () {
        ...
        document.getElementById('fetch-secret-button').addEventListener('click', function () {
            document.getElementById('error').innerHTML = '';
            document.getElementById('secret').innerHTML = '';
            get('/secret', function (response) {
                document.getElementById('secret').innerHTML = response.secret;
            });
        });
    }

We're passing a callback to our <tt>get()</tt> function to
be executed with the Ajax <tt>responseText</tt> once the
server returns the result. Here's the code for <tt>get()</tt>:

    function get(uri, successCallback) {
        const httpReq = new XMLHttpRequest();
        httpReq.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                successCallback(JSON.parse(this.responseText));
            } else if (this.readyState === 4) {
                document.getElementById('error').innerHTML = `Server responded with error code ${this.status}`;
            }
        };
        httpReq.open('GET', uri, true);
        const token = sessionStorage.getItem('token');
        if (token) {
            httpReq.setRequestHeader('Authorization', `Bearer ${token}`)
        }
        httpReq.send();
    }

The function sets up the HTTP GET, then if it
finds an authentication token in the local
session storage, it adds the RFC standard
HTTP header <tt>Authorization: Bearer TOKENDATA</tt>.
If an error occurs, or a non-success HTTP status returns,
we display an error. Otherwise, we call the success
callback, which in our case displays the returned secret.

On the sever side, the handler for <tt>GET /secret</tt>
looks like this:

    function checkToken(req, res, next) {
        if (req.headers && req.headers.authorization) {
            const headerValues = req.headers.authorization.split(' ');
            if (headerValues.length === 2) {
                const token = headerValues[1];
                jwt.verify(token, jwtPublicKey, function (error, payload) {
                    if (error) {
                        console.log('Error decoding JWT:', error);
                        res.sendStatus(403);
                    } else {
                        const dateNow = Date.now();
                        if (dateNow < payload.exp) {
                            // You might want to regenerate the token with a fresh expiration here.
                            console.log('Verified JWT for user', payload.username);
                            req.username = payload.username;
                            next();
                        } else {
                            console.log('Expired token for user', payload.username);
                            res.sendStatus(403);
                        }
                    }
                });
                return;
            }
        }
        res.sendStatus(403);
    }
    
    function userSecret(username) {
        const matchingUsers = users.filter(obj => { return obj.username === username });
        if (matchingUsers.length > 0) {
            return matchingUsers[0].secret;
        }
        return null;
    }
    
    app.get('/secret', checkToken, function (req, res) {
        console.log('Request for secret by', req.username);
        res.send({ username: req.username, secret: userSecret(req.username) });
    });

Notice how Express allows a chain of filters to be
applied to the incoming request. The <tt>checkToken()</tt>
is just that, a filter that is supposed to call the
Express-supplied
<tt>next()</tt> function if all is well. If any error is
detected, the filter can terminate the filter chain by
calling <tt>res.sendStatus(CODE)</tt>.

A filter can also attach additional information to the
request or response objects before calling <tt>next()</tt>.
In our case, we supply the authenticated user's username
to the downstream function by setting <tt>req.username</tt>.

That's it! We've seen how a NodeJS application can serve a
SPA by supplying static resources for ordinary HTTP requests
and dynamic JSON data for Ajax requests.

Initial password authentication allows generation of a token
on the server that the client can attach to later requests
as evidence that the bearer has previously been authenticated.

### Limitations

There are a number of issues with this solution to client
authentication for a SPA:

- For this solution to be secure, in production,
  we must use SSL. This is typically done by having a proper
  Web server such as Nginx or Apache or a proxy service like
  HAProxy performing the SSL
  termination and possibly serving the static resources
  directly while proxying
  API requests to the port NodeJS is listening on.

- Storage of tokens in the browser's sessionStorage is
  dangerous. Any script from the same origin has access
  to the sessionStorage data. Sites that use JWTs in this
  way are particularly vulnerable to XSS attacks.

## Why do devs love JWT?

If you look around online, you'll find many claims about the
superiority of JWT to other solutions. It may be difficult
to verify those claims or see the holes in the claims.

You'll also see a lot of security experts poo-pooing JWTs,
mainly because of how easy it is to do things wrong with them
plus the very real vulnerability to XSS they introduce
discussed above.

The main reason devs might legitimately love JWTs is that
they are easy to understand, are explicitly dealt with
by your client code, easy to generate, easy to verify,
and easy to pass around in HTTP headers, as the example here
and countless online tutorials online show.

Is that solution worth the risk to your users and your
application data posed by opening yourself up to the
possibility of XSS attacks?

If you believe your application could not possibly serve
malicious scripts that might steal JWTs at all, you might feel
safe enough to "play with fire" and use JWTs with local
storage.

If, on the other hand, your application does serve
user-generated content (what interesting application doesn't?),
however, you should consider a more secure alternative
to JWTs in local storage.

## A more secure alternative: httpOnly cookies

Instead of sending the JWT directly to the client script
and having the client return the token in an Authorization header,
the server can set a cookie to the JWT contents and turn on
the <tt>httpOnly</tt> flag so that client-side JavaScript
cannot access the token and relay it to a malicious site.

To switch to cookies in our application, add the
<tt>cookie-parser</tt> middleware with the following:

    $ npm install --save cookie-parser
    
In the server script:

    const cookieParser = require('cookie-parser);
    ...
    app.use(cookieParser());

In the snippet executed on successful authentication:
    
    res.cookie('authToken', generateJwt(userObj.username), { httpOnly: true });
    res.send({ username: userObj.username });

You can check that the browser, after authentication, has recorded
a cookie named <tt>authToken</tt> whose value is the JWT contents
and which has the <tt>httpOnly</tt> flag set.

Next, we simply remove the Authorization header from subsequent
requests to <tt>GET /secret</tt> (remember that formerly we
added the <tt>Authorization</tt> header):

    httpReq.open('GET', uri, true);
    httpReq.send();

Finally, in the server script, we can perform the same
validation of the incoming cookie as we previously performed
for the JWT:

    function checkToken(req, res, next) {
        if (req.cookies && req.cookies.authToken) {
            const token = req.cookies.authToken;
            jwt.verify(token, jwtPublicKey, function (error, payload) {
                if (error) {
                    console.log('Error decoding JWT:', error);
                    res.sendStatus(403);
                } else {
                    const dateNow = Date.now();
                    if (dateNow < payload.exp) {
                        // You might want to regenerate the token with a fresh expiration here.
                        console.log('Verified JWT for user', payload.username);
                        req.username = payload.username;
                        next();
                    } else {
                        console.log('Expired token for user', payload.username);
                        res.sendStatus(403);
                    }
                }
            });
            return;
        }
        res.sendStatus(403);
    }

You can verify that no local session storage is needed any
more, and since we specified the <tt>httpOnly</tt> flag on
the cookie, the cookie value won't be available to a would-be
XSS attack.

It's actually simpler than the original <tt>Authorization</tt>
header design, as the client no longer has to manually attach
a header to the HTTP request, and the server processing is
almost identical.

The new problem with this solution is that it is vulnerable
to CSRF attacks. Let's try to address that next.

## An even better alternative: JWT + httpOnly cookies + CSRF tokens

OK, so JWTs stored client side make us vulnerable to XSS,
but cookies sent automatically with every request to our
application make us vulnerable to CSRF.

The key to the CSRF vulnerability is that our JWT token, which
is basically a free login as the authenticated user for whomever
gets it, will be forwarded to the application by our
browser *no matter where the code to make the request comes
from*. A malicious
site can plant a link to a target site you've already authenticated
against and trick you into invoking it.

To fix both,
we use the JWT + httpOnly cookie from the previous section
and CSRF tokens.
