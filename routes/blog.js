const express = require("express");
const router = express.Router();
const db = require("../data/database");
const bcrypt = require('bcryptjs');
const { render } = require("ejs");
const xss = require("xss");

router.get("/", (req, res) => {
  res.redirect("/posts");
})

router.get("/posts", async (req, res) => {
  const query = `SELECT blogdb.posts.*, authors.name AS author_name FROM blogdb.posts INNER JOIN blogdb.authors ON blogdb.posts.author_id = authors.id;`
  const [posts] = await db.query(query);
  res.render("posts-list", { posts: posts });
})

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


router.get("/new-post", async (req, res) => {
  if (!req.session.isAuthenticated === true) {
    return res.status(401).render("401");
  }
  const [authors] = await db.query('SELECT * FROM authors');
  res.render("create-post", { authors: authors });
})

router.get("/posts/:id", async (req, res) => {
  const query = `SELECT blogdb.posts.*, blogdb.authors.name AS author_name, blogdb.authors.email AS author_email FROM blogdb.posts INNER JOIN blogdb.authors ON blogdb.posts.author_id = blogdb.authors.id WHERE blogdb.posts.id = ?`
  const [posts] = await db.query(query, [req.params.id]);
  if (!posts || posts.length === 0) {
    return res.render("404");
  };
  res.render("post-detail", { post: posts[0] });
})

router.get("/posts/:id/edit", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.status(401).render("401");
  }
  const query = `SELECT blogdb.posts.*, blogdb.authors.name, blogdb.authors.email FROM blogdb.posts INNER JOIN blogdb.authors ON blogdb.posts.author_id = blogdb.authors.id WHERE blogdb.posts.id = ?`;
  const [authors] = await db.query(query, [req.params.id]);
  const [posts] = await db.query("SELECT * FROM blogdb.posts WHERE id = ?", [req.params.id])
  if (!posts || posts.length === 0) {
    return res.status(404).render("404");
  };
  const authorName = authors[0]["name"];
  const authorEmail = authors[0]["email"];
  if (authorEmail !== req.session.user.email) {
    const errorMessage = "Non hai i permessi per modificare questo commento. Non ti appartiene."
    return res.status(403).render("403-author", {errorMessage : errorMessage, authorName: authorName}); 
  }
  console.log(authorEmail);
  console.log(req.session.user.email);
  res.render("update-post", { post: posts[0] })
})

router.post("/posts/:id/edit", async (req, res) => {
  const query = "UPDATE posts SET title = ?, summary = ?, body = ? WHERE id = ?";
  await db.query(query, [req.body.title, req.body.summary, req.body.content, req.params.id]);
  res.redirect("/posts");
})


router.post("/posts", async (req, res) => {
  const data = [req.body.title, req.body.summary, req.body.content, req.body.author];
  await db.query("INSERT INTO posts (title, summary, body, author_id) VALUES (?)", [data]);
  res.redirect("/posts");
})

router.get("/postsDelete", async (req, res) => {
  if (!res.locals.isAuthenticated && !res.locals.isAdmin) {
    return res.status(403).render("403");
  }
  await db.query("TRUNCATE TABLE blogdb.posts;");
  res.redirect("/posts");
})

router.post("/posts/:id/delete", async (req, res) => {
  if (!res.locals.isAuthenticated) {
    return res.redirect("/401");
  }
  const query = `SELECT blogdb.posts.*, blogdb.authors.name, blogdb.authors.email FROM blogdb.posts INNER JOIN blogdb.authors ON blogdb.posts.author_id = blogdb.authors.id WHERE blogdb.posts.id = ?`;
  const [authors] = await db.query(query, [req.params.id]);
  const [posts] = await db.query("SELECT * FROM blogdb.posts WHERE id = ?", [req.params.id])
  if (!posts || posts.length === 0) {
    return res.redirect("/404");
  };
  const authorName = authors[0]["name"];
  const authorEmail = authors[0]["email"];
  if (authorEmail !== req.session.user.email) {
    req.session.errorDelete = {
      hasError : true,
      authorName : authorName,
      message: "Non hai i permessi per eliminare questo commento. Non ti appartiene."
    }
    return res.redirect("/403-author"); 
  }
  await db.query("DELETE FROM blogdb.posts WHERE id = ?", [req.params.id]);
  res.redirect("/posts");
})

router.post("/logout", (req, res)=>{
  req.session.user = null;
  req.session.isAuthenticated = false;
  res.redirect("/");
})

router.get("/401", async (req, res) => {
  res.render("401");
})

router.get("/403", async (req, res) => {
  res.render("403");
});

router.get("/403-author", async (req, res) => {
  const errorMessage = req.session.errorDelete.message;
  const authorName = req.session.errorDelete.authorName;
  res.render("403-author", {errorMessage : errorMessage, authorName, authorName});
});

router.get("/404", async (req, res) => {
  res.render("404");
});

router.get("/500", async (req, res) => {
  res.render("500");
})










module.exports = router;