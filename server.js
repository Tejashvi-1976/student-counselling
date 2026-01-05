const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const fs = require('fs');
const db = require('./config/db');
const bodyParser = require('body-parser');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/offers', express.static(path.join(__dirname, 'offers')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'verysecretkey',
  resave: false,
  saveUninitialized: true
}));
app.use(flash());

// middleware to expose user/admin to views
app.use((req, res, next) => {
  res.locals.student = req.session.student || null;
  res.locals.admin = req.session.admin || null;
  res.locals.messages = req.flash();
  next();
});

// Home
app.get('/', (req, res) => {
  res.render('index');
});

// STUDENT AUTH
app.get('/student/signup', (req, res) => res.render('student/signup'));
app.post('/student/signup', async (req, res) => {
  if(isNaN(req.name)){
    alert("invalid name");
  }
  else{
    const { name, email, password, phone } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
      await db.query('INSERT INTO students (name,email,password,phone) VALUES (?,?,?,?)', [name,email,hashed,phone]);
      req.flash('success', 'Signup successful. Please login.');
      res.redirect('/student/login');
  }catch(err){
    console.error(err);
    req.flash('error', 'Error creating account — maybe email exists.');
    res.redirect('/student/signup');
  }
  }
  
});

app.get('/student/login', (req, res) => res.render('student/login'));
app.post('/student/login', async (req, res) => {
  const { email, password } = req.body;
  try{
    const [rows] = await db.query('SELECT * FROM students WHERE email=?', [email]);
    if(rows.length===0){ req.flash('error','Invalid credentials'); return res.redirect('/student/login'); }
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if(!ok){ req.flash('error','Invalid credentials'); return res.redirect('/student/login'); }
    req.session.student = { id: user.id, name: user.name, email: user.email };
    res.redirect('/student/dashboard');
  }catch(e){ console.error(e); req.flash('error','Login error'); res.redirect('/student/login'); }
});

app.get('/student/logout', (req, res) => { req.session.student = null; res.redirect('/'); });

// STUDENT DASHBOARD
app.get('/student/dashboard', async (req, res) => {
  if(!req.session.student) return res.redirect('/student/login');
  const [rows] = await db.query('SELECT * FROM students WHERE id=?', [req.session.student.id]);
  const student = rows[0];
  res.render('student/dashboard', { student });
});

// Submit personal info & marks
app.post('/student/details', async (req, res) => {
  if(!req.session.student) return res.redirect('/student/login');
  const id = req.session.student.id;
  const { name, phone, hs_math, hs_science, hs_english, hs_hindi, plus_physics, plus_chem, plus_math, choice1, choice2 } = req.body;
  const hs = { Math: hs_math||0, Science: hs_science||0, English: hs_english||0, Hindi: hs_hindi||0 };
  const plus2 = { Physics: plus_physics||0, Chemistry: plus_chem||0, Math: plus_math||0 };
  try{
    await db.query('UPDATE students SET name=?, phone=?, highschool_marks_json=?, plus2_marks_json=?, branch_choice1=?, branch_choice2=? WHERE id=?', 
      [name, phone, JSON.stringify(hs), JSON.stringify(plus2), choice1, choice2, id]);
    req.flash('success','Details saved.');
    res.redirect('/student/dashboard');
  }catch(e){ console.error(e); req.flash('error','Save error'); res.redirect('/student/dashboard'); }
});

// Upload receipt (payment)
app.post('/student/upload_receipt', upload.single('receipt'), async (req, res) => {
  if(!req.session.student) return res.redirect('/student/login');
  const id = req.session.student.id;
  if(!req.file){ req.flash('error','No file uploaded'); return res.redirect('/student/dashboard'); }
  const filename = req.file.filename;
  await db.query('UPDATE students SET payment_receipt=?, payment_verified=0 WHERE id=?', [filename, id]);
  req.flash('success','Receipt uploaded. Awaiting admin verification.');
  res.redirect('/student/dashboard');
});

// Student accept allocation
app.post('/student/accept_allocation', async (req, res) => {
  if(!req.session.student) return res.redirect('/student/login');
  const id = req.session.student.id;
  await db.query('UPDATE students SET accepted_allocation=1 WHERE id=?', [id]);
  req.flash('success','You accepted the allocated branch. Please upload payment receipt.');
  res.redirect('/student/dashboard');
});

// ADMIN AUTH
app.get('/admin/signup', (req, res) => res.render('admin/signup'));
app.post('/admin/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try{
    await db.query('INSERT INTO admins (name,email,password) VALUES (?,?,?)', [name,email,hashed]);
    req.flash('success','Admin created. Login.');
    res.redirect('/admin/login');
  }catch(e){ console.error(e); req.flash('error','Error creating admin'); res.redirect('/admin/signup'); }
});
app.get('/admin/login', (req, res) => res.render('admin/login'));
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  try{
    const [rows] = await db.query('SELECT * FROM admins WHERE email=?', [email]);
    if(rows.length===0){ req.flash('error','Invalid'); return res.redirect('/admin/login'); }
    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password);
    if(!ok){ req.flash('error','Invalid'); return res.redirect('/admin/login'); }
    req.session.admin = { id: admin.id, name: admin.name, email: admin.email };
    res.redirect('/admin/dashboard');
  }catch(e){ console.error(e); req.flash('error','Login error'); res.redirect('/admin/login'); }
});
app.get('/admin/logout', (req, res) => { req.session.admin = null; res.redirect('/'); });

// Admin dashboard - ranking by total plus2 marks (descending)
app.get('/admin/dashboard', async (req, res) => {
  if(!req.session.admin) return res.redirect('/admin/login');
  const [rows] = await db.query('SELECT * FROM students');
  // compute total marks
  const students = rows.map(s => {
    let plus2 = {};
    try{ plus2 = JSON.parse(s.plus2_marks_json || '{}'); }catch(e){}
    const total = ['Physics','Chemistry','Math'].reduce((a,b)=> a + (parseFloat(plus2[b])||0), 0);
    return { ...s, plus2, total };
  }).sort((a,b)=> b.total - a.total);
  res.render('admin/dashboard', { students });
});

// Allocate branch (admin action)
app.post('/admin/allocate', async (req, res) => {
  if(!req.session.admin) return res.redirect('/admin/login');
  const { student_id, branch } = req.body;
  await db.query('UPDATE students SET allocated_branch=?, allocated_by_admin=? WHERE id=?', [branch, req.session.admin.id, student_id]);
  req.flash('success','Branch allocated.');
  res.redirect('/admin/dashboard');
});

// Verify payment
app.post('/admin/verify_payment', async (req, res) => {
  if(!req.session.admin) return res.redirect('/admin/login');
  const { student_id } = req.body;
  // mark payment_verified and generate offer letter
  await db.query('UPDATE students SET payment_verified=1, offer_generated=1 WHERE id=?', [student_id]);
  // create simple offer HTML
  const [rows] = await db.query('SELECT * FROM students WHERE id=?', [student_id]);
  const s = rows[0];
  const offerHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Offer Letter</title></head><body><h1>Offer Letter</h1><p>Student: ${s.name}</p><p>Allocated Branch: ${s.allocated_branch || 'Not allocated'}</p><p>Date: ${new Date().toLocaleString()}</p></body></html>`;
  if(!fs.existsSync('offers')) fs.mkdirSync('offers');
  fs.writeFileSync(path.join('offers', 'offer_'+student_id+'.html'), offerHtml);
  req.flash('success','Payment verified and offer generated.');
  res.redirect('/admin/dashboard');
});

// Serve offer to student if generated
app.get('/student/offer', async (req, res) => {
  if(!req.session.student) return res.redirect('/student/login');
  const id = req.session.student.id;
  const offerPath = path.join('offers', 'offer_'+id+'.html');
  if(fs.existsSync(offerPath)) return res.sendFile(path.resolve(offerPath));
  req.flash('error','Offer not yet generated.');
  res.redirect('/student/dashboard');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port http://localhost:3000', PORT));
