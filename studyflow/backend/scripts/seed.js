// scripts/seed.js
// Populates the DB with sample data for development / demos
// Run: node scripts/seed.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
require('../config/database'); // initialise + migrate

const User     = require('../models/User');
const Note     = require('../models/Note');
const Deadline = require('../models/Deadline');
const { StudyPlan } = require('../models/StudyPlan');
const db       = require('../config/database');

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ── Wipe existing seed data ────────────────────────────────────────────────
  db.exec(`
    DELETE FROM resource_searches;
    DELETE FROM payments;
    DELETE FROM study_plans;
    DELETE FROM deadlines;
    DELETE FROM notes;
    DELETE FROM refresh_tokens;
    DELETE FROM users WHERE email IN ('demo@studyflow.ai', 'pro@studyflow.ai');
  `);

  // ── Users ──────────────────────────────────────────────────────────────────
  const freeUser = await User.create({
    name:     'Arjun Mehta',
    email:    'demo@studyflow.ai',
    password: 'Demo1234',
    course:   'B.Tech CSE',
  });
  console.log(`✓ Free user: ${freeUser.email}`);

  const proUser = await User.create({
    name:     'Priya Sharma',
    email:    'pro@studyflow.ai',
    password: 'Demo1234',
    course:   'CA Final',
  });
  User.upgradePlan(proUser.id, 'pro');
  console.log(`✓ Pro user:  ${proUser.email}`);

  // ── Notes ──────────────────────────────────────────────────────────────────
  Note.create({
    user_id:   freeUser.id,
    title:     'Data Structures — Binary Trees',
    summary:   'Binary trees are hierarchical structures where each node has at most two children. They form the basis of BSTs, heaps, and decision trees.',
    key_points: ['Root is the topmost node', 'Left child < parent in BST', 'Height determines search complexity', 'Traversal: in-order, pre-order, post-order', 'Balanced trees guarantee O(log n) ops'],
    topics:    ['Data Structures', 'Binary Trees', 'Algorithms'],
    difficulty: 'Intermediate',
  });

  Note.create({
    user_id:   freeUser.id,
    title:     'Thermodynamics — First & Second Laws',
    summary:   'The first law states energy is conserved; the second introduces entropy as a measure of disorder in a system.',
    key_points: ['Energy cannot be created or destroyed', 'Entropy always increases in isolated systems', 'Carnot engine achieves max efficiency', 'ΔU = Q - W (first law formula)', 'Gibbs free energy determines spontaneity'],
    topics:    ['Thermodynamics', 'Physics', 'Entropy'],
    difficulty: 'Advanced',
  });
  console.log('✓ Notes created');

  // ── Deadlines ──────────────────────────────────────────────────────────────
  const today = new Date();
  const addDays = (d) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() + d);
    return dt.toISOString().split('T')[0];
  };

  Deadline.bulkCreate(freeUser.id, [
    { title: 'OS Assignment 2 — Scheduling Algorithms', dueDate: addDays(3),  type: 'assignment', priority: 'high' },
    { title: 'DBMS Mid-Term Exam',                      dueDate: addDays(7),  type: 'exam',       priority: 'high' },
    { title: 'Computer Networks Lab Report',             dueDate: addDays(12), type: 'project',    priority: 'medium' },
    { title: 'Algorithm Design Quiz 3',                  dueDate: addDays(5),  type: 'quiz',       priority: 'medium' },
    { title: 'Software Engineering Project Submission',  dueDate: addDays(21), type: 'project',    priority: 'low' },
  ]);
  console.log('✓ Deadlines created');

  // ── Study Plan ─────────────────────────────────────────────────────────────
  StudyPlan.create({
    user_id:    freeUser.id,
    title:      'DBMS 7-Day Exam Plan',
    subject:    'Database Management Systems',
    exam_date:  addDays(7),
    total_days: 7,
    daily_hours: 3,
    level:      'Intermediate',
    plan_json: [
      { day: 1, focus: 'ER Diagrams & Relational Model', tasks: ['Draw 5 ER diagrams', 'Convert ER to relational', 'Practice normalization'], duration: '3 hours' },
      { day: 2, focus: 'SQL — DDL & DML',               tasks: ['CREATE/DROP/ALTER syntax', 'INSERT, UPDATE, DELETE', 'Practice 20 SQL queries'], duration: '3 hours' },
      { day: 3, focus: 'Joins & Subqueries',             tasks: ['INNER, LEFT, RIGHT JOINs', 'Correlated subqueries', 'Write complex query set'], duration: '3 hours' },
      { day: 4, focus: 'Normalization 1NF–3NF',          tasks: ['Understand functional dependencies', 'Normalize sample schemas', 'Identify anomalies'], duration: '3 hours' },
      { day: 5, focus: 'Transactions & Concurrency',     tasks: ['ACID properties', 'Deadlock scenarios', 'Two-phase locking'], duration: '3 hours' },
      { day: 6, focus: 'Indexing & Query Optimization',  tasks: ['B+ trees', 'Explain plans', 'Index creation strategies'], duration: '3 hours' },
      { day: 7, focus: 'Full Revision & Mock Test',      tasks: ['Attempt past papers', 'Review weak topics', 'Rest & confidence building'], duration: '3 hours' },
    ],
  });
  User.incrementPlans(freeUser.id);
  console.log('✓ Study plan created');

  console.log('\n✅ Seed complete!\n');
  console.log('Login credentials:');
  console.log('  Free → demo@studyflow.ai / Demo1234');
  console.log('  Pro  → pro@studyflow.ai  / Demo1234');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
