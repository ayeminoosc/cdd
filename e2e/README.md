# E2E Test Cases for QR Menu Backoffice

This directory contains Contract-Driven Development (CDD) files for end-to-end test automation of the signup and signin flows.

## Structure

```
e2e/
├── contracts/
│   ├── pages/           # Page Object Models
│   │   ├── Signup.page.cdd
│   │   ├── Signin.page.cdd
│   │   └── Login.page.cdd (existing)
│   └── scenarios/       # Test Scenarios
│       ├── Signup.test.cdd
│       ├── Signin.test.cdd
│       ├── UserJourney.test.cdd
│       └── Login.test.cdd (existing)
├── data/                # Test Data (JSON)
│   ├── signup.data.json
│   ├── signup.invalid.data.json
│   ├── signin.data.json
│   ├── signin.invalid.data.json
│   ├── user-journey.data.json
│   └── login.data.json (existing)
└── cdd.md              # E2E module instructions
```

## Page Object Models

### 1. SignupPage (`contracts/pages/Signup.page.cdd`)
Page object for the user registration page at `https://platform.acfsoft.com/register`

**Elements:**
- `firstNameInput` - First name text field
- `lastNameInput` - Last name text field
- `emailInput` - Email address text field
- `passwordInput` - Password text field
- `signupBtn` - Sign up button
- `signinLink` - Link to navigate to signin page

**Actions:**
- `navigateTo()` - Navigate to the signup page
- `fillSignupForm(firstName, lastName, email, password)` - Fill all form fields
- `signup(firstName, lastName, email, password)` - Complete signup process
- `clickSignin()` - Navigate to signin page
- `expectSignupPageVisible()` - Verify signup page elements
- `expectRedirectToLogin()` - Verify redirect after successful signup

### 2. SigninPage (`contracts/pages/Signin.page.cdd`)
Page object for the user login page at `https://platform.acfsoft.com/login`

**Elements:**
- `emailInput` - Email address text field
- `passwordInput` - Password text field
- `signinBtn` - Sign in button
- `signupLink` - Link to navigate to signup page
- `errorMsg` - Error message display

**Actions:**
- `navigateTo()` - Navigate to the signin page
- `fillLoginForm(email, password)` - Fill login form
- `login(email, password)` - Complete login process
- `clickSignup()` - Navigate to signup page
- `expectSigninPageVisible()` - Verify signin page elements
- `expectErrorMessage(msg)` - Verify error message
- `expectRedirectToDashboard()` - Verify redirect to dashboard
- `expectUserLoggedIn(userName)` - Verify user is logged in

## Test Scenarios

### 1. Signup Flow (`contracts/scenarios/Signup.test.cdd`)
Tests for user registration functionality:
- **testSuccessfulSignup** - Verify user can successfully sign up
- **testNavigationToSignin** - Verify navigation from signup to signin
- **testSignupPageElements** - Verify all signup page elements are present
- **testSignupValidation** - Verify form validation with invalid data

### 2. Signin Flow (`contracts/scenarios/Signin.test.cdd`)
Tests for user login functionality:
- **testSuccessfulSignin** - Verify user can successfully sign in
- **testInvalidCredentials** - Verify error handling for invalid credentials
- **testNavigationToSignup** - Verify navigation from signin to signup
- **testSigninPageElements** - Verify all signin page elements are present
- **testEmptyFormSubmission** - Verify validation for empty form

### 3. User Journey (`contracts/scenarios/UserJourney.test.cdd`)
End-to-end tests for complete user flows:
- **testCompleteUserJourney** - Full signup and signin flow
- **testSignupThenSigninFlow** - Immediate signin after signup

## Test Data

### Valid Test Data
- **signin.data.json** - Valid credentials for signin tests
  - Test user: `test_user@gmail.com` / `testpassword1234`
- **signup.data.json** - Valid data for signup tests

### Invalid Test Data
- **signin.invalid.data.json** - Invalid credentials for error testing
- **signup.invalid.data.json** - Invalid data for validation testing

### User Journey Data
- **user-journey.data.json** - Data for complete end-to-end flows

## Test User Credentials

**Primary Test User:**
- Email: `test_user@gmail.com`
- Password: `testpassword1234`
- First Name: `Test`
- Last Name: `User`

This user was created during the test exploration phase and can be used for signin tests.

## Running Tests

To generate test code from these CDD contracts:

```bash
# Using CDD build command
./cdd build

# Or with Claude Code CLI
/cdd build
```

The generated test code will be created in the `e2e/generated/` directory based on the framework specified in `project.cdd`.

## Application Flow

1. Navigate to `https://admin.qrshop.acfsoft.com/`
2. Application redirects to `https://platform.acfsoft.com/login` (SSO login)
3. User can sign up via the "Sign up" link
4. After signup, user is redirected back to login page
5. After successful login, user is redirected to `https://admin.qrshop.acfsoft.com/dashboard`
6. Dashboard shows user name and logout button

## Notes

- The application uses SSO (Single Sign-On) through `platform.acfsoft.com`
- All authentication flows go through the platform subdomain
- After successful authentication, users are redirected to the QR Shop admin dashboard
- The signup process automatically redirects to login page upon completion
- Email and password authentication is supported along with Google OAuth
