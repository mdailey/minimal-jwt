
// currentRoute stores the URI of the current view within the application

let currentRoute = '/login';

// Enable back button to take us to a previous state

window.addEventListener('popstate', function (event) {
    changeRoute(event.state);
});

// Initial setup to be performed once the page is fully loaded

window.onload = function () {

    // Switch to the login view

    changeRoute('/login');

    // Click handler for the login button

    document.getElementById('login-button').addEventListener('click', function () {
        const username = document.getElementById('username').value
        const password = document.getElementById('password').value
        const body = JSON.stringify({username: username, password: password});
        const httpReq = new XMLHttpRequest();
        httpReq.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                storeToken(JSON.parse(this.responseText));
                changeRoute('/secret');
            } else if (this.readyState === 4) {
                document.getElementById('login-error').innerHTML = `Server responded with error code ${this.status}`;
                document.getElementById('login-result').innerHTML = '';
            }
        };
        httpReq.open('POST', '/login', true);
        httpReq.setRequestHeader('Content-Type', 'application/json');
        httpReq.send(body);
    });

    // Click handler for the logout button

    document.getElementById('logout-button').addEventListener('click', function () {
        clearToken();
        changeRoute('/login');
    });

    // Click handler for the "fetch secret" button

    document.getElementById('fetch-secret-button').addEventListener('click', function () {
        document.getElementById('error').innerHTML = '';
        document.getElementById('secret').innerHTML = '';
        get('/secret', function (response) {
            document.getElementById('secret').innerHTML = response.secret;
        });
    });
}

// Function abstracting an Ajax (XMLHttpRequest) GET with JWT authentication token

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
    httpReq.send();
}

// Function to clear the user's authentication token, thus logging them out

function clearToken() {
    sessionStorage.clear();
}

// Function to store an authentication token received from the server

function storeToken(loginResponse) {
    console.log('Storing login response', loginResponse);
    sessionStorage.setItem('username', loginResponse.username);
    sessionStorage.setItem('token', loginResponse.token);
}

// Function to clear the login form before we display it

function clearLogin() {
    document.getElementById('login-error').innerHTML = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-result').innerHTML = '';
}

// Function to clear the secret view before we display it

function clearSecret() {
    document.getElementById('secret').innerHTML = '';
    document.getElementById('error').innerHTML = '';
}

// Function to change to a different view within the application. Currently we have just 2 views.

function changeRoute(uri) {
    switch(uri) {
        case '/login':
            clearLogin();
            document.getElementById('secret-div').style.display = 'none';
            document.getElementById('login-div').style.display = 'block';
            window.history.pushState(currentRoute, 'Minimal JWT - Login', '/login');
            break;
        case '/secret':
            clearSecret();
            document.getElementById('secret-div').style.display = 'block';
            document.getElementById('login-div').style.display = 'none';
            window.history.pushState(currentRoute, 'Minimal JWT - Secret', '/secret');
            break;
        default:
            throw new Error('Unknown route');
    }
    currentRoute = uri;
}
