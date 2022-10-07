const express = require("express");
const router = express.Router();
const db = require("../data/database");
const { render } = require("ejs");

router.get("/", (req, res) => {
  res.redirect("/posts");
})

router.get("/posts", async (req, res) => {
  const query = `SELECT blogdb.posts.*, authors.name AS author_name FROM blogdb.posts INNER JOIN blogdb.authors ON blogdb.posts.author_id = authors.id;`
  const [posts] = await db.query(query);
  res.render("posts-list", { posts: posts });
})

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
  if (!res.locals.isAuthenticated || !res.locals.isAdmin) {
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