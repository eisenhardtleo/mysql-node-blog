require("dotenv").config();
const path = require('path');
const db = require("./data/database");
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST,
  port : process.env.DB_PORT,
  database : process.env.DB_NAME,
  user : process.env.DB_USER,
  password : process.env.DB_PWD
});
const app = express();

const blogRoutes = require('./routes/blog');
const authRoutes = require('./routes/auth');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
	key: 'session_cookie',
	secret: process.env.DB_SECRET,
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
  cookie : {
    maxAge : 60*1000 * 20
  }
}))

app.use(async (req, res, next)=>{
  const user = req.session.user;
  const isAuthenticated = req.session.isAuthenticated;
  if (!user || !isAuthenticated) {
    return next();
  }
  const query = "SELECT id, name, email, isAdmin FROM blogdb.users WHERE blogdb.users.email = ?";
  const [data] = await db.query(query, [req.session.user.email]);
  const isAdmin = data[0]["isAdmin"];
  const email = data[0]["email"];
  const name = data[0]["name"];
  res.locals.isAuthenticated = isAuthenticated;
  res.locals.name = name;
  res.locals.email = email;
  res.locals.isAdmin = isAdmin;
  next();
})

app.use(blogRoutes);
app.use(authRoutes);

app.use(function (error, req, res, next) {
  console.log(error);
  res.status(500).render('500');
});

const port = process.env.PORT || 3000;

app.listen(port, ()=>{
  console.log(`Server running on port ${port}`);
});