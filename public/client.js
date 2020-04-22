
// currentRoute stores the URI of the current view within the application

let currentRoute = '/login';

// Enable back button to take us to a previous state

window.addEventListener('popstate', function (event) {
    changeRoute(event.state);
});

// Get cookie value by name (from stack overflow!)

function getCookieValue(name) {
    const val = document.cookie.match('(^|[^;]+)\\s*' + name + '\\s*=\\s*([^;]+)');
    return val ? val.pop() : '';
}

// Perform an HTTP POST. Display any error in errorElement; call successCallback on success.

function post(uri, body, errorElement, successCallback) {
    const httpReq = new XMLHttpRequest();
    httpReq.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            if (successCallback) {
                successCallback(JSON.parse(this.responseText));
            }
        } else if (this.readyState === 4) {
            if (errorElement) {
                document.getElementById(errorElement).innerHTML = `Server responded with error code ${this.status}`;
            }
        }
    };
    httpReq.open('POST', uri, true);
    httpReq.setRequestHeader('Content-Type', 'application/json');
    httpReq.setRequestHeader('X-XSRF-TOKEN', getCookieValue('XSRF-TOKEN'));
    httpReq.send(body);
}

// Perform HTTP GET. Display any error in errorElement; call successCallback on success.

function get(uri, errorElement, successCallback) {
    const httpReq = new XMLHttpRequest();
    httpReq.onreadystatechange = function () {
        if (this.readyState === 4 && this.status === 200) {
            if (successCallback) {
                successCallback(JSON.parse(this.responseText));
            }
        } else if (this.readyState === 4) {
            if (errorElement) {
                document.getElementById(errorElement).innerHTML = `Server responded with error code ${this.status}`;
            }
        }
    };
    httpReq.open('GET', uri, true);
    httpReq.send();
}

// Initial setup to be performed once the page is fully loaded

window.onload = function () {

    // Switch to the login view

    changeRoute('/login');

    // Click handler for the login button

    document.getElementById('login-button').addEventListener('click', function () {
        const username = document.getElementById('username').value
        const password = document.getElementById('password').value
        const body = JSON.stringify({username: username, password: password});
        post('/login', body, 'login-error', function (res) {
            sessionStorage.setItem('username', res.username);
            changeRoute('/secret');
        });
    });

    // Click handler for the "fetch secret" button

    document.getElementById('fetch-secret-button').addEventListener('click', function () {
        document.getElementById('error').innerHTML = '';
        document.getElementById('secret').innerHTML = '';
        get('/secret', 'error', function (response) {
            document.getElementById('secret').innerHTML = response.secret;
        });
    });

    // Click handler for the logout button

    document.getElementById('logout-button').addEventListener('click', function () {
        sessionStorage.clear();
        post('/logout', null, 'error', null);
        changeRoute('/login');
    });
}

// Function to clear the login form and display it

function displayLogin() {
    document.getElementById('login-error').innerHTML = '';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('login-result').innerHTML = '';
    document.getElementById('secret-div').style.display = 'none';
    document.getElementById('login-div').style.display = 'block';
}

// Function to clear the secret view then display it

function displaySecretView() {
    document.getElementById('secret').innerHTML = '';
    document.getElementById('error').innerHTML = '';
    document.getElementById('secret-div').style.display = 'block';
    document.getElementById('login-div').style.display = 'none';
}

// Function to change to a different view within the application. Currently we have just 2 views.

function changeRoute(uri) {
    switch(uri) {
        case '/login':
            displayLogin();
            window.history.pushState(currentRoute, 'Minimal JWT - Login', '/login');
            break;
        case '/secret':
            displaySecretView();
            window.history.pushState(currentRoute, 'Minimal JWT - Secret', '/secret');
            break;
        default:
            throw new Error('Unknown route');
    }
    currentRoute = uri;
}
