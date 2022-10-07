const express = require("express");
const router = express.Router();
const db = require("../data/database");
const bcrypt = require('bcryptjs');
const { render } = require("ejs");

router.get("/signup", async (req, res) => {
  let sessionInputData = req.session.inputData;
  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      name : "",
      email: "",
      password: ""
    }
  }
  req.session.inputData = null;
  res.render("signup", { sessionInputData: sessionInputData });
})

router.post("/signup", async function (req, res) {
  const enteredName = req.body.name;
  const enteredEmail = req.body.email;
  const confirmedEmail = req.body["confirm-email"];
  const enteredPassword = req.body.password;
  const hashedPassword = await bcrypt.hash(enteredPassword, 12);
  const query = "SELECT email FROM blogdb.users WHERE blogdb.users.email = ?";
  const [data] = await db.query(query, [enteredEmail]);
  const alreadyExistingEmail = data[0];
  if (alreadyExistingEmail) {
    if (enteredEmail === alreadyExistingEmail.email) {
      req.session.inputData = {
        hasError: true,
        message: "Utente già esistente",
        name : enteredName,
        email: enteredEmail,
        confirmedEmail: confirmedEmail,
        password: enteredPassword
      }
      req.session.save(() => {
        res.redirect("/signup");
      })
      return;
    }
  }
  
  if (!enteredName || !enteredEmail === "" || !confirmedEmail === "" || enteredEmail !== confirmedEmail || !enteredEmail.includes("@")) {
    req.session.inputData = {
      hasError: true,
      message: "Dati non validi - si prega di controllare e riprovare",
      name : enteredName,
      email: enteredEmail,
      confirmedEmail: confirmedEmail,
      password: hashedPassword
    }
    req.session.save(() => {
      res.redirect("/signup");
    })
    return;
  }
  
  if (enteredPassword.length < 6) {
    req.session.inputData = {
      hasError: true,
      message: "Password troppo breve (min 6 caratteri)",
      name : enteredName,
      email: enteredEmail,
      confirmedEmail: confirmedEmail,
      password: hashedPassword
    }
    req.session.save(() => {
      res.redirect("/signup");
    })
    return;
  }
  
  const newUser = [enteredName, enteredEmail, hashedPassword];
  await db.query("INSERT INTO blogdb.users (name, email, password) VALUES (?)", [newUser]);
  await db.query(`INSERT INTO blogdb.authors (name, email) SELECT name, email FROM blogdb.users WHERE email = ?`, [enteredEmail])
  console.log("Utente registrato");
  res.redirect("/login");
});

router.get("/login", async function (req, res) {
  let sessionInputData = req.session.inputData;
  if (!sessionInputData) {
    sessionInputData = {
      hasError: false,
      email: "",
      password: ""
    }
  }
  req.session.inputData = null;
  res.render("login", { sessionInputData: sessionInputData });
});

router.post("/login", async function (req, res) {
  const enteredEmail = req.body.email;
  const enteredPassword = req.body.password;
  
  const query = "SELECT id, email, password, isAdmin FROM blogdb.users WHERE blogdb.users.email = ?";
  const [data] = await db.query(query, [enteredEmail]);
  
  if (data.length === 0) {
    req.session.inputData = {
      hasError: true,
      message: "Could not log you in, please check your credentials.",
      email: enteredEmail,
      password: ""
    }
    req.session.save(() => {
      res.redirect("/login")
    })
    return;
  }
  
  const existingUserEmail = data[0]["email"];
  const existingUserPassword = data[0]["password"];
  const passwordEqual = await bcrypt.compare(enteredPassword, existingUserPassword);
  if (!passwordEqual) {
    req.session.inputData = {
      hasError: true,
      message: "Dati non validi - si prega di controllare e riprovare",
      email: enteredEmail,
      password: ""
    }

    req.session.save(() => {
      res.redirect("/login");
    });
    return;
  }
  const existingUserId = data[0]["id"];
  req.session.user = { id: existingUserId, email: existingUserEmail };
  req.session.isAuthenticated = true;
  req.session.save(() => {
    res.redirect("/new-post");
  })
});

router.post("/logout", (req, res)=>{
  req.session.user = null;
  req.session.isAuthenticated = false;
  res.redirect("/login");
})





module.exports = router;