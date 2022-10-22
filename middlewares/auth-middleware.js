const db = require("../data/database");

async function auth (req, res, next) {
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
  }


  module.exports = auth;