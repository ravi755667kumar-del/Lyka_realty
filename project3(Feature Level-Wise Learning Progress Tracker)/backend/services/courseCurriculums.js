import { v4 as uuidv4 } from 'uuid';
import { callGenerativeAI } from './aiMentorService.js';

/**
 * 1. FULL-STACK WEB DEVELOPMENT CURRICULUM
 */
export function getWebDevelopmentLevels() {
  return [
    {
      id: 'level-1',
      title: 'Level 1: Web Foundations & Core JavaScript',
      order: 1,
      status: 'In Progress',
      isLocked: false,
      prerequisites: 'None',
      completionCriteria: 'Master HTML5 semantic layout, modern CSS Grid/Flexbox, and asynchronous ES6+ JavaScript.',
      topics: [
        {
          id: 'topic-1-1',
          title: 'HTML5 Semantic Architecture & Accessibility (a11y)',
          shortExplanation: 'Semantic structure (main, nav, article, aside), document outlines, ARIA roles, and screen-reader accessibility.',
          learningObjectives: ['Structure accessible web documents', 'Use semantic tags properly', 'Implement ARIA landmark attributes'],
          prerequisites: 'Basic computer literacy',
          recommendedResources: [
            { title: 'MDN Web Docs: HTML Elements', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML', type: 'Docs' },
            { title: 'Web Accessibility Guidelines (WCAG)', url: 'https://www.w3.org/WAI/standards-guidelines/wcag/', type: 'Article' }
          ],
          exercisePrompt: 'Build an accessible HTML profile card with header, image, navigation, and contact section using semantic tags.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.0,
          status: 'Not Started'
        },
        {
          id: 'topic-1-2',
          title: 'Modern CSS3: Flexbox, Grid & Responsive Layouts',
          shortExplanation: 'One-dimensional layouts with Flexbox, two-dimensional grids with CSS Grid, fluid typography, and mobile-first media queries.',
          learningObjectives: ['Master Flexbox alignment and axis flow', 'Create complex two-dimensional CSS Grid layouts', 'Implement responsive mobile-first viewports'],
          prerequisites: 'HTML5 Semantic Architecture',
          recommendedResources: [
            { title: 'A Complete Guide to Flexbox - CSS-Tricks', url: 'https://css-tricks.com/snippets/css/a-guide-to-flexbox/', type: 'Docs' }
          ],
          exercisePrompt: 'Create a responsive 3-column product catalog layout that switches to 1 column on mobile screens using CSS Grid.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-1-3',
          title: 'Modern JavaScript (ES6+): Closures, Promises & Async/Await',
          shortExplanation: 'Scope chains, closures, arrow functions, destructuring, promises, async/await, and the JavaScript event loop.',
          learningObjectives: ['Understand lexical scope and closures', 'Handle asynchronous workflows with async/await', 'Explain microtasks and macrotasks in the event loop'],
          prerequisites: 'Basic programming concepts',
          recommendedResources: [
            { title: 'JavaScript.info: Promises & Async', url: 'https://javascript.info/async', type: 'Docs' }
          ],
          exercisePrompt: 'Write an asynchronous function `fetchUserData(userId)` that fetches JSON from a dummy API, handles errors with try/catch, and returns parsed profile data.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-1-4',
          title: 'DOM Manipulation & Browser Event Handling',
          shortExplanation: 'Selecting and modifying DOM nodes, event bubbling and capturing, event delegation, and performance optimization with debouncing.',
          learningObjectives: ['Perform performant DOM updates', 'Implement event delegation on dynamic lists', 'Debounce input events for search queries'],
          prerequisites: 'Modern JavaScript (ES6+)',
          recommendedResources: [
            { title: 'MDN: Introduction to Events', url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events', type: 'Docs' }
          ],
          exercisePrompt: 'Implement a debounced live search filter that dynamically queries and renders matching items in a list without re-rendering the whole page.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-2',
      title: 'Level 2: Modern Frontend Frameworks (React & UI Architecture)',
      order: 2,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 1: Web Foundations & Core JavaScript (Requires 100% completion of Level 1)',
      completionCriteria: 'Build component hierarchies, manage complex local/global state, and leverage React hooks.',
      topics: [
        {
          id: 'topic-2-1',
          title: 'React Components, JSX & Props Anatomy',
          shortExplanation: 'Component thinking, declarative JSX compilation, unidirectional data flow, and prop validation.',
          learningObjectives: ['Break down UI mockups into modular components', 'Pass typed props and callbacks', 'Render conditional UI elements'],
          prerequisites: 'Modern JavaScript (ES6+)',
          recommendedResources: [{ title: 'React Official Docs: Describing the UI', url: 'https://react.dev/learn/describing-the-ui', type: 'Docs' }],
          exercisePrompt: 'Create a reusable Card component in React with title, description, badge, and custom action button.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-2-2',
          title: 'State Management & React Hooks (useState, useEffect, useRef)',
          shortExplanation: 'Hook rules, state reconciliation, effect lifecycles, dependency arrays, and DOM references with useRef.',
          learningObjectives: ['Manage atomic state with useState', 'Synchronize effects with useEffect safely', 'Persist mutable values without re-renders using useRef'],
          prerequisites: 'React Components and Props',
          recommendedResources: [{ title: 'React Hooks Guide', url: 'https://react.dev/reference/react', type: 'Docs' }],
          exercisePrompt: 'Build an interactive stopwatch component with Start, Pause, and Reset using useState, useEffect, and useRef.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-2-3',
          title: 'Context API & Global State Management',
          shortExplanation: 'Solving prop drilling with createContext and useContext, reducer patterns with useReducer, and optimizing re-render boundaries.',
          learningObjectives: ['Implement centralized theme/auth state with Context', 'Combine useReducer with Context for scalable state actions', 'Prevent unnecessary consumer re-renders'],
          prerequisites: 'State Management & React Hooks',
          recommendedResources: [{ title: 'React Context Documentation', url: 'https://react.dev/learn/passing-data-deeply-with-context', type: 'Docs' }],
          exercisePrompt: 'Implement a Shopping Cart Context with actions to Add, Remove, and Update item quantities.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-2-4',
          title: 'Client-Side Routing & SPA Navigation',
          shortExplanation: 'Declarative routing with React Router, nested routes, URL search parameters, dynamic route segments, and protected route wrappers.',
          learningObjectives: ['Configure nested layouts with Outlet', 'Extract dynamic route parameters (useParams)', 'Create authenticated route guards'],
          prerequisites: 'React Components & Context',
          recommendedResources: [{ title: 'React Router Tutorial', url: 'https://reactrouter.com/en/main/start/tutorial', type: 'Docs' }],
          exercisePrompt: 'Set up a multi-page app with Home, Dashboard, and Login pages, redirecting unauthenticated users to Login.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-3',
      title: 'Level 3: Backend Development (Node.js & Express)',
      order: 3,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 2: Modern Frontend Frameworks (Requires 100% completion of Level 2)',
      completionCriteria: 'Build high-performance RESTful APIs, structure middleware chains, and manage file I/O.',
      topics: [
        {
          id: 'topic-3-1',
          title: 'Node.js Runtime & Asynchronous Event Loop',
          shortExplanation: 'Non-blocking I/O, V8 engine internals, Libuv thread pool, CommonJS vs ES Modules, and filesystem streams.',
          learningObjectives: ['Understand Node.js single-threaded event loop', 'Read/write files with fs.promises and streams', 'Create modular backend packages'],
          prerequisites: 'Modern JavaScript (ES6+)',
          recommendedResources: [{ title: 'Node.js Documentation: Event Loop', url: 'https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick', type: 'Docs' }],
          exercisePrompt: 'Write a Node.js script that streams a large log file line-by-line and extracts error lines to a separate file.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-3-2',
          title: 'RESTful API Architecture with Express.js',
          shortExplanation: 'Routing, HTTP status codes, request/response headers, JSON body parsing, and RESTful resource endpoints.',
          learningObjectives: ['Design clean REST endpoints according to standard HTTP verbs', 'Parse route params, query strings, and request bodies', 'Return standardized JSON error and success payloads'],
          prerequisites: 'Node.js Runtime',
          recommendedResources: [{ title: 'Express.js Guide', url: 'https://expressjs.com/en/guide/routing.html', type: 'Docs' }],
          exercisePrompt: 'Build CRUD endpoints for a `/api/products` resource with GET, POST, PUT, and DELETE methods.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-3-3',
          title: 'Middleware, Request Validation & Centralized Error Handling',
          shortExplanation: 'Express middleware chains, CORS configuration, schema validation with Zod/Joi, rate limiting, and centralized error middleware.',
          learningObjectives: ['Write custom logging and auth middleware', 'Validate request payloads with schema libraries', 'Implement global error handlers avoiding process crashes'],
          prerequisites: 'RESTful API Architecture',
          recommendedResources: [{ title: 'Writing Express Middleware', url: 'https://expressjs.com/en/guide/writing-middleware.html', type: 'Docs' }],
          exercisePrompt: 'Create a request validation middleware that rejects missing email or password fields with HTTP 400 and clear error messages.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-4',
      title: 'Level 4: Databases & Data Modeling (SQL & NoSQL)',
      order: 4,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 3: Backend Development (Requires 100% completion of Level 3)',
      completionCriteria: 'Model relational schemas, write performant SQL queries, and implement ORM/ODM integration.',
      topics: [
        {
          id: 'topic-4-1',
          title: 'Relational Database Design & PostgreSQL',
          shortExplanation: 'Tables, primary & foreign keys, normalization (1NF, 2NF, 3NF), one-to-many & many-to-many relationships, and indexes.',
          learningObjectives: ['Design normalized relational schemas', 'Write complex SQL JOINs and aggregation queries', 'Add indexes to optimize read queries'],
          prerequisites: 'Backend Development',
          recommendedResources: [{ title: 'PostgreSQL Tutorial', url: 'https://www.postgresqltutorial.com/', type: 'Docs' }],
          exercisePrompt: 'Write SQL statements to create Users, Orders, and OrderItems tables with foreign keys and cascade rules.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-4-2',
          title: 'ORMs & Schema Migrations (Prisma / Drizzle)',
          shortExplanation: 'Type-safe data modeling, automatic migration generation, seed scripts, relation queries, and connection pooling.',
          learningObjectives: ['Define Prisma/Drizzle schema models', 'Execute migration CLI commands', 'Query database with type-safety in Node.js'],
          prerequisites: 'Relational Database Design',
          recommendedResources: [{ title: 'Prisma Getting Started', url: 'https://www.prisma.io/docs/getting-started', type: 'Docs' }],
          exercisePrompt: 'Write a Prisma query that fetches a user by ID along with their 5 most recent completed orders.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-4-3',
          title: 'NoSQL Databases & Document Storage (MongoDB)',
          shortExplanation: 'BSON documents, collections, embedding vs referencing, MongoDB Aggregation Framework, and indexing strategies.',
          learningObjectives: ['Understand when to choose document vs relational storage', 'Model nested document schemas', 'Write aggregation pipelines for analytics'],
          prerequisites: 'Database fundamentals',
          recommendedResources: [{ title: 'MongoDB University', url: 'https://learn.mongodb.com/', type: 'Docs' }],
          exercisePrompt: 'Build a MongoDB aggregation pipeline to compute the total revenue and order count grouped by month.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-5',
      title: 'Level 5: Full-Stack Authentication, Security & Real-Time',
      order: 5,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 4: Databases & Data Modeling (Requires 100% completion of Level 4)',
      completionCriteria: 'Secure full-stack applications with JWT/OAuth, prevent web attacks, and establish real-time WebSockets.',
      topics: [
        {
          id: 'topic-5-1',
          title: 'Authentication & Session Architecture (JWT & Refresh Tokens)',
          shortExplanation: 'Password hashing with bcrypt, JWT token signing & verification, HTTP-only secure cookies, and refresh token rotation.',
          learningObjectives: ['Safely hash and verify passwords with salt rounds', 'Issue short-lived access tokens and secure refresh cookies', 'Protect routes using token verification middleware'],
          prerequisites: 'Backend Development and Databases',
          recommendedResources: [{ title: 'JWT.io Guide', url: 'https://jwt.io/introduction', type: 'Docs' }],
          exercisePrompt: 'Implement an Express auth middleware verifying `Authorization: Bearer <token>` and attaching user payload to `req.user`.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-5-2',
          title: 'Web Application Security & OWASP Defense',
          shortExplanation: 'Defenses against Cross-Site Scripting (XSS), SQL Injection, Cross-Site Request Forgery (CSRF), security headers with Helmet, and CORS policies.',
          learningObjectives: ['Sanitize and escape user inputs to prevent XSS', 'Use parameterized queries against SQL injection', 'Configure Helmet security headers and strict CORS'],
          prerequisites: 'Authentication Architecture',
          recommendedResources: [{ title: 'OWASP Top 10 Security Risks', url: 'https://owasp.org/www-project-top-ten/', type: 'Docs' }],
          exercisePrompt: 'Configure Express with Helmet, strict CORS whitelist, and input sanitization to harden the API.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-5-3',
          title: 'Real-Time Communication with WebSockets (Socket.io)',
          shortExplanation: 'Bidirectional client-server communication, WebSocket handshake, rooms & namespaces, and connection heartbeat management.',
          learningObjectives: ['Establish WebSocket connections between React and Node', 'Broadcast room events for chat/notifications', 'Handle disconnects and reconnections gracefully'],
          prerequisites: 'Full-Stack architecture',
          recommendedResources: [{ title: 'Socket.io Documentation', url: 'https://socket.io/docs/v4/', type: 'Docs' }],
          exercisePrompt: 'Build a live notification service where a backend event broadcasts instantly to subscribed React clients.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-6',
      title: 'Level 6: Production DevOps, Docker & Cloud Deployment',
      order: 6,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 5: Full-Stack Authentication & Security (Requires 100% completion of Level 5)',
      completionCriteria: 'Containerize multi-container apps, set up automated CI/CD pipelines, and deploy to cloud platforms.',
      topics: [
        {
          id: 'topic-6-1',
          title: 'Containerization with Docker & Docker Compose',
          shortExplanation: 'Docker engine, multi-stage Dockerfiles for React/Node, image size optimization, and multi-service orchestration with Compose.',
          learningObjectives: ['Write efficient multi-stage Dockerfiles', 'Compose full-stack frontend, backend, and PostgreSQL containers', 'Manage persistent data with Docker volumes'],
          prerequisites: 'Full-Stack Web Development',
          recommendedResources: [{ title: 'Docker Official Get Started', url: 'https://docs.docker.com/get-started/', type: 'Docs' }],
          exercisePrompt: 'Write a `docker-compose.yml` file connecting a Node.js backend, a React frontend, and a PostgreSQL database.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-6-2',
          title: 'CI/CD Pipelines with GitHub Actions',
          shortExplanation: 'Automated test triggers, lint checks, build artifacts, secret management, and continuous deployment workflows.',
          learningObjectives: ['Create GitHub Actions workflow YAML files', 'Run automated Jest/Vitest test suites on pull requests', 'Deploy automatically upon merging to main'],
          prerequisites: 'Containerization',
          recommendedResources: [{ title: 'GitHub Actions Documentation', url: 'https://docs.github.com/en/actions', type: 'Docs' }],
          exercisePrompt: 'Create a `.github/workflows/deploy.yml` pipeline that lints, tests, and builds your application on every push.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    }
  ];
}

/**
 * 2. DEVOPS & CLOUD ENGINEERING CURRICULUM
 */
export function getDevOpsLevels() {
  return [
    {
      id: 'level-1',
      title: 'Level 1: Linux Administration & Shell Scripting',
      order: 1,
      status: 'In Progress',
      isLocked: false,
      prerequisites: 'None',
      completionCriteria: 'Master Linux kernel basics, filesystem hierarchy, process management, and automated Bash scripts.',
      topics: [
        {
          id: 'topic-1-1',
          title: 'Linux Filesystem, Permissions & SSH Hardening',
          shortExplanation: 'FHS hierarchy, chmod/chown permissions, sudoers configuration, SSH key pairs, and disabling root login.',
          learningObjectives: ['Manage Linux users and groups', 'Configure SSH keys and disable password auth', 'Understand file permission octal masks'],
          prerequisites: 'Basic terminal usage',
          recommendedResources: [{ title: 'Linux Journey', url: 'https://linuxjourney.com/', type: 'Docs' }],
          exercisePrompt: 'Write a bash command sequence that creates a restricted user group, assigns directory ownership, and sets 750 permissions.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-1-2',
          title: 'Process Management, Systemd & Cron Automation',
          shortExplanation: 'PS, top, kill signals, writing custom systemd service units, journalctl log inspection, and scheduling cron jobs.',
          learningObjectives: ['Create and enable systemd background services', 'Troubleshoot crashed services with journalctl', 'Schedule automated maintenance tasks with crontab'],
          prerequisites: 'Linux Filesystem',
          recommendedResources: [{ title: 'Systemd Service Guide', url: 'https://www.freedesktop.org/software/systemd/man/systemd.service.html', type: 'Docs' }],
          exercisePrompt: 'Write a systemd service unit file `app.service` that starts a Node app with restart=always and non-root execution.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-1-3',
          title: 'Bash Shell Scripting & Error Handling',
          shortExplanation: 'Variables, loops, condition checks, arguments handling, exit codes ($?), pipe pipelines, and `set -euo pipefail`.',
          learningObjectives: ['Write robust Bash automation scripts', 'Implement strict safety modes with set -euo pipefail', 'Parse command line flags with getopts'],
          prerequisites: 'Linux Administration',
          recommendedResources: [{ title: 'Pure Bash Bible', url: 'https://github.com/dylanaraps/pure-bash-bible', type: 'Docs' }],
          exercisePrompt: 'Create a bash script that checks free disk space, archives files older than 30 days, and logs results with timestamps.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-2',
      title: 'Level 2: Networking & Version Control (Git)',
      order: 2,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 1: Linux Administration (Requires 100% completion of Level 1)',
      completionCriteria: 'Configure network routing, reverse proxies with Nginx, and advanced Git collaborative workflows.',
      topics: [
        {
          id: 'topic-2-1',
          title: 'Computer Networking & Protocols (TCP/IP, DNS, HTTP/S)',
          shortExplanation: 'IP subnetting, DNS resolution flow, TCP three-way handshake, TLS termination, and diagnostic tools (curl, dig, traceroute, netstat).',
          learningObjectives: ['Diagnose connectivity issues with ping, dig, and curl', 'Understand DNS records (A, CNAME, TXT, MX)', 'Analyze TLS certificate handshakes'],
          prerequisites: 'Linux fundamentals',
          recommendedResources: [{ title: 'Cloudflare: Learning Networking', url: 'https://www.cloudflare.com/learning/network-layer/what-is-the-network-layer/', type: 'Docs' }],
          exercisePrompt: 'Use curl to inspect HTTP response headers, SSL certificate expiry, and redirect chains of a domain.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-2-2',
          title: 'Reverse Proxy & Load Balancing with Nginx',
          shortExplanation: 'Virtual hosts, reverse proxying upstream servers, SSL termination with Let\'s Encrypt, caching headers, and rate limiting.',
          learningObjectives: ['Configure Nginx reverse proxy blocks', 'Implement round-robin upstream load balancing', 'Set up HTTPS SSL certificates using Certbot'],
          prerequisites: 'Computer Networking',
          recommendedResources: [{ title: 'Nginx Beginner\'s Guide', url: 'https://nginx.org/en/docs/beginners_guide.html', type: 'Docs' }],
          exercisePrompt: 'Write an Nginx configuration snippet that reverse proxies requests to `http://127.0.0.1:5000` with WebSocket support headers.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-2-3',
          title: 'Advanced Git & Branching Strategies (GitFlow, Trunk-Based)',
          shortExplanation: 'Git internals (.git object database), rebasing vs merging, cherry-picking, resolving merge conflicts, and commit signing.',
          learningObjectives: ['Execute clean interactive rebases', 'Enforce branch protection rules and PR approvals', 'Adopt trunk-based continuous integration'],
          prerequisites: 'Version Control Basics',
          recommendedResources: [{ title: 'Pro Git Book', url: 'https://git-scm.com/book/en/v2', type: 'Docs' }],
          exercisePrompt: 'Perform an interactive rebase (`git rebase -i`) to squash 3 development commits into one clean conventional commit message.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-3',
      title: 'Level 3: Containerization (Docker Deep Dive)',
      order: 3,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 2: Networking & Version Control (Requires 100% completion of Level 2)',
      completionCriteria: 'Build hardened, minimal container images, manage storage volumes, and isolate virtual networks.',
      topics: [
        {
          id: 'topic-3-1',
          title: 'Docker Architecture, Namespaces & Cgroups',
          shortExplanation: 'Container isolation via Linux namespaces (PID, NET, MNT) and cgroups resource limits, Docker daemon vs containerd.',
          learningObjectives: ['Understand how containers isolate processes without hypervisors', 'Set CPU and memory resource limits on containers', 'Inspect running container stats and logs'],
          prerequisites: 'Linux Administration',
          recommendedResources: [{ title: 'Docker Overview', url: 'https://docs.docker.com/get-started/overview/', type: 'Docs' }],
          exercisePrompt: 'Launch a container with memory capped at 256MB and 0.5 CPU cores, verifying limits via `docker stats`.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-3-2',
          title: 'Dockerfile Optimization & Multi-Stage Builds',
          shortExplanation: 'Layer caching rules, non-root USER directives, Alpine/Distroless minimal base images, and .dockerignore practices.',
          learningObjectives: ['Reduce container image size by up to 90%', 'Eliminate build tools from production images', 'Harden images against common CVE vulnerabilities'],
          prerequisites: 'Docker Architecture',
          recommendedResources: [{ title: 'Best Practices for Writing Dockerfiles', url: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/', type: 'Docs' }],
          exercisePrompt: 'Write a multi-stage Dockerfile that builds a Go or Node app in stage 1 and packages only the binary into a scratch/distroless image in stage 2.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-4',
      title: 'Level 4: CI/CD Pipelines & Continuous Delivery',
      order: 4,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 3: Containerization (Requires 100% completion of Level 3)',
      completionCriteria: 'Construct automated continuous integration and delivery pipelines with security scanning and artifact registries.',
      topics: [
        {
          id: 'topic-4-1',
          title: 'CI/CD Pipeline Design & GitHub Actions',
          shortExplanation: 'Workflow runners, matrices, artifact caching, environment secrets, and automated testing gates.',
          learningObjectives: ['Design modular multi-stage CI/CD pipelines', 'Cache node_modules and Docker layers for faster builds', 'Implement approval environments for staging vs production'],
          prerequisites: 'Docker & Git',
          recommendedResources: [{ title: 'GitHub Actions Syntax Guide', url: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions', type: 'Docs' }],
          exercisePrompt: 'Create a GitHub Actions pipeline that builds a Docker image, scans it for vulnerabilities with Trivy, and pushes to GitHub Container Registry (GHCR).',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-4-2',
          title: 'Static Analysis, Linting & Secret Detection',
          shortExplanation: 'Pre-commit hooks, SonarQube / ESLint code quality gates, and git-leaks secret scanning to prevent credential leakage.',
          learningObjectives: ['Prevent accidental API key commits with pre-commit hooks', 'Integrate security scanners into pull request checks', 'Enforce test coverage thresholds'],
          prerequisites: 'CI/CD Pipeline Design',
          recommendedResources: [{ title: 'Gitleaks Security Scanner', url: 'https://github.com/gitleaks/gitleaks', type: 'Docs' }],
          exercisePrompt: 'Configure a pipeline step running Gitleaks that fails the build if private keys or API tokens are detected in commit history.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-5',
      title: 'Level 5: Container Orchestration (Kubernetes)',
      order: 5,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 4: CI/CD Pipelines (Requires 100% completion of Level 4)',
      completionCriteria: 'Deploy, scale, and manage fault-tolerant microservices on Kubernetes clusters.',
      topics: [
        {
          id: 'topic-5-1',
          title: 'Kubernetes Architecture: Control Plane & Worker Nodes',
          shortExplanation: 'API Server, Etcd datastore, Kube-Scheduler, Kube-Controller-Manager, Kubelet, Kube-Proxy, and Pod lifecycles.',
          learningObjectives: ['Understand Kubernetes declarative control loops', 'Interact with clusters using kubectl commands', 'Explain how Etcd maintains cluster state consensus'],
          prerequisites: 'Docker containerization',
          recommendedResources: [{ title: 'Kubernetes Official Basics', url: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', type: 'Docs' }],
          exercisePrompt: 'Write a Kubernetes Pod manifest with readiness and liveness HTTP probes and resource limits.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 4.0,
          status: 'Not Started'
        },
        {
          id: 'topic-5-2',
          title: 'Deployments, ReplicaSets & Rolling Updates',
          shortExplanation: 'Zero-downtime rolling updates, rollback mechanisms, Horizontal Pod Autoscalers (HPA), and ConfigMaps/Secrets.',
          learningObjectives: ['Deploy applications with zero-downtime rolling updates', 'Mount sensitive environment variables from Secret objects', 'Configure automatic horizontal scaling based on CPU utilization'],
          prerequisites: 'Kubernetes Architecture',
          recommendedResources: [{ title: 'Kubernetes Deployments Guide', url: 'https://kubernetes.io/docs/concepts/workloads/controllers/deployment/', type: 'Docs' }],
          exercisePrompt: 'Create a Deployment manifest with 3 replicas, a rolling update strategy, and an attached ClusterIP service.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-6',
      title: 'Level 6: Infrastructure as Code (Terraform) & Cloud Monitoring',
      order: 6,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 5: Container Orchestration (Requires 100% completion of Level 5)',
      completionCriteria: 'Provision cloud infrastructure with Terraform and monitor services with Prometheus & Grafana.',
      topics: [
        {
          id: 'topic-6-1',
          title: 'Infrastructure as Code with Terraform (HCL)',
          shortExplanation: 'Terraform providers, state management, remote state locking with S3 and DynamoDB, modular infrastructure, and drift detection.',
          learningObjectives: ['Declare cloud resources in HashiCorp Configuration Language (HCL)', 'Manage state locks to prevent concurrent corruption', 'Create reusable infrastructure modules'],
          prerequisites: 'Cloud fundamentals',
          recommendedResources: [{ title: 'Terraform Documentation', url: 'https://developer.hashicorp.com/terraform/docs', type: 'Docs' }],
          exercisePrompt: 'Write a Terraform module provisioning a cloud VPC with public and private subnets, an internet gateway, and route tables.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 4.0,
          status: 'Not Started'
        },
        {
          id: 'topic-6-2',
          title: 'Site Reliability Engineering: Prometheus & Grafana Observability',
          shortExplanation: 'Metrics collection (counters, gauges, histograms), PromQL queries, alerting rules, and Grafana dashboard visualization.',
          learningObjectives: ['Instrument microservices with Prometheus client metrics', 'Write PromQL alert expressions for error rates and latency', 'Construct operational Grafana dashboards'],
          prerequisites: 'Infrastructure & Kubernetes',
          recommendedResources: [{ title: 'Prometheus Getting Started', url: 'https://prometheus.io/docs/introduction/overview/', type: 'Docs' }],
          exercisePrompt: 'Configure a Prometheus alert rule that triggers if 5xx HTTP response rates exceed 5% over a 5-minute evaluation window.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        }
      ]
    }
  ];
}

/**
 * 3. MOBILE APP DEVELOPMENT CURRICULUM
 */
export function getAppDevelopmentLevels() {
  return [
    {
      id: 'level-1',
      title: 'Level 1: Mobile Programming Foundations (Dart & Object-Oriented)',
      order: 1,
      status: 'In Progress',
      isLocked: false,
      prerequisites: 'None',
      completionCriteria: 'Master typed mobile programming languages, null safety, asynchronous Futures, and collections.',
      topics: [
        {
          id: 'topic-1-1',
          title: 'Mobile Programming Syntax & Sound Null Safety',
          shortExplanation: 'Strong typing, null safety (nullable vs non-nullable types, ! and ? operators), late initialization, and immutability.',
          learningObjectives: ['Write clean null-safe mobile code', 'Master functional collection transformations', 'Prevent runtime null pointer exceptions'],
          prerequisites: 'Basic programming literacy',
          recommendedResources: [{ title: 'Dart Language Tour', url: 'https://dart.dev/guides/language/language-tour', type: 'Docs' }],
          exercisePrompt: 'Write a Dart/Kotlin class representing a `UserProfile` with sound null safety, default parameters, and a custom factory constructor.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-1-2',
          title: 'Asynchronous Programming: Futures & Streams',
          shortExplanation: 'Event loops, async/await, Future error handling, and reactive Stream subscriptions for real-time mobile data.',
          learningObjectives: ['Handle network responses with Futures', 'Listen and transform continuous Streams of data', 'Manage stream subscription lifecycles to avoid memory leaks'],
          prerequisites: 'Mobile Programming Syntax',
          recommendedResources: [{ title: 'Dart Asynchronous Programming', url: 'https://dart.dev/codelabs/async-await', type: 'Docs' }],
          exercisePrompt: 'Create an asynchronous Stream that periodically emits updated GPS location coordinates every second.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-2',
      title: 'Level 2: Mobile UI & Responsive Design Systems',
      order: 2,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 1: Mobile Programming Foundations (Requires 100% completion of Level 1)',
      completionCriteria: 'Build beautiful, adaptive user interfaces supporting both iOS and Android design guidelines.',
      topics: [
        {
          id: 'topic-2-1',
          title: 'Declarative UI Tree & Component Layouts',
          shortExplanation: 'Widget/Component trees, Flex containers (Rows, Columns), Stack positioning, and constraint rules (BoxConstraints).',
          learningObjectives: ['Understand how mobile rendering trees calculate layout bounds', 'Avoid render overflow errors (RenderFlex overflow)', 'Create responsive card layouts'],
          prerequisites: 'Mobile Programming Foundations',
          recommendedResources: [{ title: 'Flutter Layout Guide', url: 'https://docs.flutter.dev/ui/layout', type: 'Docs' }],
          exercisePrompt: 'Build an Instagram-style post card with user avatar, image, like button, and caption formatted cleanly.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        },
        {
          id: 'topic-2-2',
          title: 'Adaptive Material Design & Cupertino Themes',
          shortExplanation: 'Material 3 dynamic theming, dark mode switching, typography scales, Cupertino iOS styling, and safe-area insets.',
          learningObjectives: ['Implement automatic light/dark mode adaptation', 'Ensure content respects camera notches with SafeArea', 'Create consistent branded theme palettes'],
          prerequisites: 'Declarative UI Tree',
          recommendedResources: [{ title: 'Material Design 3 Mobile Specs', url: 'https://m3.material.io/', type: 'Docs' }],
          exercisePrompt: 'Configure a dynamic ThemeController allowing users to toggle between Light, Dark, and System theme preferences.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.1,
          estimatedHours: 2.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-3',
      title: 'Level 3: Mobile State Management & Navigation',
      order: 3,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 2: Mobile UI & Responsive Design Systems (Requires 100% completion of Level 2)',
      completionCriteria: 'Implement reactive, decoupled state management and declarative deep-linking routing.',
      topics: [
        {
          id: 'topic-3-1',
          title: 'Decoupled State Management (Riverpod / BLoC / Redux)',
          shortExplanation: 'Separation of business logic from UI, immutable state emissions, dependency injection, and performance profiling.',
          learningObjectives: ['Architect apps using reactive state controllers', 'Prevent unnecessary widget rebuilds', 'Test state logic in isolation from UI'],
          prerequisites: 'Mobile UI Layouts',
          recommendedResources: [{ title: 'Riverpod Documentation', url: 'https://riverpod.dev/docs/introduction/getting_started', type: 'Docs' }],
          exercisePrompt: 'Implement a state controller managing an e-commerce checkout flow with cart validation and discount calculations.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-3-2',
          title: 'Declarative Navigation & Deep Linking',
          shortExplanation: 'Route tables, URL path parsing, handling incoming web deep links, parameter passing, and bottom tab navigation bars.',
          learningObjectives: ['Implement declarative URL-based navigation', 'Handle cold app starts from push notification deep links', 'Persist bottom navigation tab history'],
          prerequisites: 'Decoupled State Management',
          recommendedResources: [{ title: 'GoRouter Flutter Guide', url: 'https://pub.dev/packages/go_router', type: 'Docs' }],
          exercisePrompt: 'Set up a router configuration that handles a `/product/:id` deep link and navigates directly to the product detail view.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-4',
      title: 'Level 4: Native Hardware APIs & Offline Storage',
      order: 4,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 3: Mobile State Management & Navigation (Requires 100% completion of Level 3)',
      completionCriteria: 'Access hardware sensors, store encrypted offline databases, and manage background synchronization.',
      topics: [
        {
          id: 'topic-4-1',
          title: 'Local Database & Offline-First Architecture (SQLite / Hive / Room)',
          shortExplanation: 'Embedded key-value and SQL storage, caching remote API responses, database schema migrations, and sync queues.',
          learningObjectives: ['Persist structured user records locally on device storage', 'Implement offline-first data fetching strategies', 'Execute local database schema version migrations'],
          prerequisites: 'Mobile State Management',
          recommendedResources: [{ title: 'Offline-First Mobile Architecture', url: 'https://docs.flutter.dev/cookbook/persistence/sqlite', type: 'Docs' }],
          exercisePrompt: 'Build an offline sync manager that queues user actions locally when disconnected and uploads them upon reconnection.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-4-2',
          title: 'Camera, Geolocation & Biometric Authentication',
          shortExplanation: 'Runtime permission requesting (iOS Info.plist & Android Manifest), camera capture, GPS geolocation tracking, and FaceID/Fingerprint authentication.',
          learningObjectives: ['Safely request OS permissions with user-friendly explanations', 'Capture and compress photos for network upload', 'Authenticate users with device biometrics'],
          prerequisites: 'Local Database',
          recommendedResources: [{ title: 'Local Auth Biometrics Guide', url: 'https://pub.dev/packages/local_auth', type: 'Docs' }],
          exercisePrompt: 'Write a biometric authentication helper that prompts the user with FaceID or Fingerprint before viewing a private screen.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-5',
      title: 'Level 5: Cloud Integration, Push Notifications & App Store Release',
      order: 5,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 4: Native Hardware APIs & Offline Storage (Requires 100% completion of Level 4)',
      completionCriteria: 'Integrate cloud notification messaging, automate CI/CD build signing, and publish apps to Google Play & App Store.',
      topics: [
        {
          id: 'topic-5-1',
          title: 'Push Notifications with Firebase Cloud Messaging (FCM)',
          shortExplanation: 'APNs and FCM registration tokens, background message handlers, rich notifications with images, and topic subscriptions.',
          learningObjectives: ['Register device tokens with backend databases', 'Process incoming notifications in foreground, background, and terminated states', 'Send segmented notifications by user interests'],
          prerequisites: 'Mobile Architecture',
          recommendedResources: [{ title: 'Firebase Cloud Messaging Guide', url: 'https://firebase.google.com/docs/cloud-messaging', type: 'Docs' }],
          exercisePrompt: 'Implement a background message handler that displays a local OS notification banner when a remote push is received.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-5-2',
          title: 'App Store Signing, Fastlane & Production Release',
          shortExplanation: 'Keystore and provisioning profile generation, semantic versioning, automated build signing with Fastlane, and store compliance.',
          learningObjectives: ['Generate Android App Bundles (AAB) and iOS IPA binaries', 'Automate screenshot capture and uploads with Fastlane', 'Comply with Apple App Review and Google Play policies'],
          prerequisites: 'Full Mobile Development cycle',
          recommendedResources: [{ title: 'Fastlane Automation Docs', url: 'https://docs.fastlane.tools/', type: 'Docs' }],
          exercisePrompt: 'Write a Fastlane `Fastfile` lane that runs unit tests, increments build numbers, and builds signed release binaries.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 4.0,
          status: 'Not Started'
        }
      ]
    }
  ];
}

/**
 * 4. CYBERSECURITY & ETHICAL HACKING CURRICULUM
 */
export function getCybersecurityLevels() {
  return [
    {
      id: 'level-1',
      title: 'Level 1: Cybersecurity Foundations & Network Security',
      order: 1,
      status: 'In Progress',
      isLocked: false,
      prerequisites: 'None',
      completionCriteria: 'Master the CIA triad, packet analysis with Wireshark, port scanning with Nmap, and firewall rules.',
      topics: [
        {
          id: 'topic-1-1',
          title: 'CIA Triad, Threat Modeling & Security Principles',
          shortExplanation: 'Confidentiality, Integrity, Availability, STRIDE threat modeling, least privilege, and defense-in-depth principles.',
          learningObjectives: ['Apply STRIDE methodology to system architectures', 'Enforce principle of least privilege', 'Differentiate threats, vulnerabilities, and exploits'],
          prerequisites: 'Basic IT literacy',
          recommendedResources: [{ title: 'NIST Cybersecurity Framework', url: 'https://www.nist.gov/cyberframework', type: 'Docs' }],
          exercisePrompt: 'Perform a STRIDE threat model on a web application login form, documenting threats and specific mitigations.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.0,
          estimatedHours: 2.5,
          status: 'Not Started'
        },
        {
          id: 'topic-1-2',
          title: 'Network Packet Analysis & Reconnaissance (Wireshark & Nmap)',
          shortExplanation: 'Capturing TCP/UDP traffic, inspecting protocol headers, performing stealth SYN scans with Nmap, and banner grabbing.',
          learningObjectives: ['Analyze suspicious packets in Wireshark', 'Discover open ports and service versions with Nmap', 'Detect unencrypted plaintext protocol transmissions'],
          prerequisites: 'Networking fundamentals',
          recommendedResources: [{ title: 'Nmap Official Reference Guide', url: 'https://nmap.org/book/man.html', type: 'Docs' }],
          exercisePrompt: 'Execute an Nmap command to scan top 100 ports with service version detection and OS fingerprinting on a target IP.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-2',
      title: 'Level 2: Web Application Security & OWASP Top 10',
      order: 2,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 1: Cybersecurity Foundations (Requires 100% completion of Level 1)',
      completionCriteria: 'Identify and remediate SQL Injection, Cross-Site Scripting (XSS), and Broken Object-Level Authorization (BOLA).',
      topics: [
        {
          id: 'topic-2-1',
          title: 'SQL Injection (SQLi) & Server-Side Flaws',
          shortExplanation: 'In-band, blind, and time-based SQL injection, database fingerprinting, extraction techniques, and parameterized query remediation.',
          learningObjectives: ['Identify vulnerable database input fields', 'Construct proof-of-concept injection payloads in lab environments', 'Remediate code with prepared statements and ORMs'],
          prerequisites: 'Web & Database fundamentals',
          recommendedResources: [{ title: 'PortSwigger Web Security Academy: SQLi', url: 'https://portswigger.net/web-security/sql-injection', type: 'Docs' }],
          exercisePrompt: 'Review a vulnerable code snippet and rewrite it using parameterized queries to neutralize SQL injection vulnerabilities.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        },
        {
          id: 'topic-2-2',
          title: 'Cross-Site Scripting (XSS) & Client-Side Attacks',
          shortExplanation: 'Stored, Reflected, and DOM-based XSS, cookie theft, session hijacking, and Content Security Policy (CSP) headers.',
          learningObjectives: ['Differentiate between stored, reflected, and DOM XSS', 'Safely escape dynamic HTML templates', 'Deploy strict Content Security Policy directives'],
          prerequisites: 'SQL Injection & Web Basics',
          recommendedResources: [{ title: 'OWASP XSS Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html', type: 'Docs' }],
          exercisePrompt: 'Draft a Content Security Policy (CSP) header prohibiting inline script execution and restricting connections to approved origins.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.2,
          estimatedHours: 3.0,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-3',
      title: 'Level 3: Cryptography & Identity Security',
      order: 3,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 2: Web Application Security (Requires 100% completion of Level 2)',
      completionCriteria: 'Implement cryptographic algorithms, manage digital certificates, and configure multi-factor authentication.',
      topics: [
        {
          id: 'topic-3-1',
          title: 'Modern Cryptography: AES, RSA & Elliptic Curves (ECC)',
          shortExplanation: 'Symmetric vs asymmetric ciphers, key exchange protocols (Diffie-Hellman), hashing algorithms (SHA-256), and HMAC authentication.',
          learningObjectives: ['Choose appropriate encryption ciphers for data at rest vs in transit', 'Explain public-private key pair encryption', 'Prevent replay attacks using HMAC and timestamps'],
          prerequisites: 'Cybersecurity Foundations',
          recommendedResources: [{ title: 'Practical Cryptography for Developers', url: 'https://cryptobook.nakov.com/', type: 'Docs' }],
          exercisePrompt: 'Write a program that encrypts a secret string using AES-256-GCM with a randomly generated initialization vector (IV).',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.3,
          estimatedHours: 3.5,
          status: 'Not Started'
        }
      ]
    },
    {
      id: 'level-4',
      title: 'Level 4: Penetration Testing & Ethical Hacking',
      order: 4,
      status: 'Locked',
      isLocked: true,
      prerequisites: 'Level 3: Cryptography & Identity Security (Requires 100% completion of Level 3)',
      completionCriteria: 'Execute systematic penetration testing methodologies, discover vulnerabilities, and write professional remediation reports.',
      topics: [
        {
          id: 'topic-4-1',
          title: 'Penetration Testing Frameworks (Metasploit & Burp Suite)',
          shortExplanation: 'Reconnaissance, vulnerability scanning, exploitation modules, payload generation, and documenting findings.',
          learningObjectives: ['Intercept and tamper with HTTP requests using Burp Suite proxy', 'Search and evaluate verified exploit modules', 'Produce actionable remediation guidance for engineering teams'],
          prerequisites: 'Web Application Security',
          recommendedResources: [{ title: 'PTES: Penetration Testing Execution Standard', url: 'http://www.pentest-standard.org/', type: 'Docs' }],
          exercisePrompt: 'Draft an executive vulnerability report detailing CVSS 3.1 severity scores, steps to reproduce, and permanent patches.',
          requiresExercise: true,
          exerciseSubmitted: false,
          exerciseSubmissionText: '',
          exerciseStatus: 'pending',
          lessonCompleted: false,
          assessmentScore: null,
          requiredPassingScore: 70,
          weight: 1.4,
          estimatedHours: 4.0,
          status: 'Not Started'
        }
      ]
    }
  ];
}

/**
 * 5. DYNAMIC GENERATOR FOR ANY OTHER CUSTOM GOAL
 * Uses LLM if available, or falls back to an intelligent structured template.
 */
export async function generateCustomCourseCurriculum(courseGoal, experienceLevel = 'beginner') {
  const goalClean = (courseGoal || 'Software Engineering').trim();

  // Try calling Generative AI for customized levels
  try {
    const systemPrompt = `You are an expert curriculum designer. A student wants to master: "${goalClean}".
Experience Level: ${experienceLevel}.
Generate a structured, professional 5-level curriculum in strict JSON format.

JSON Schema required:
{
  "title": "Comprehensive ${goalClean} Master Roadmap",
  "description": "Step-by-step master course taking you from fundamentals to real-world deployment.",
  "levels": [
    {
      "id": "level-1",
      "title": "Level 1: Foundations of ${goalClean}",
      "order": 1,
      "prerequisites": "None",
      "completionCriteria": "Master core concepts and pass all Level 1 assessments.",
      "topics": [
        {
          "id": "topic-1-1",
          "title": "Topic Title",
          "shortExplanation": "Concise concept overview.",
          "learningObjectives": ["Objective 1", "Objective 2"],
          "prerequisites": "Prerequisite",
          "exercisePrompt": "A practical hands-on coding/writing exercise prompt.",
          "requiresExercise": true,
          "weight": 1.0,
          "estimatedHours": 2.5
        }
      ]
    }
  ]
}

Ensure exactly 5 levels. Each level must have 2 to 4 detailed, practical topics. Respond ONLY with valid JSON.`;

    const aiRes = await callGenerativeAI({
      systemPrompt,
      query: `Generate curriculum for ${goalClean}`
    });

    if (aiRes?.text) {
      const jsonMatch = aiRes.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.levels && Array.isArray(parsed.levels) && parsed.levels.length > 0) {
          // Normalize levels to match system schema
          parsed.levels.forEach((lvl, idx) => {
            lvl.status = idx === 0 ? 'In Progress' : 'Locked';
            lvl.isLocked = idx !== 0;
            lvl.completionPercentage = 0;
            (lvl.topics || []).forEach((t) => {
              t.lessonCompleted = false;
              t.exerciseSubmitted = false;
              t.exerciseSubmissionText = '';
              t.exerciseStatus = 'pending';
              t.assessmentScore = null;
              t.requiredPassingScore = 70;
              t.status = 'Not Started';
              t.weight = t.weight || 1.0;
              t.estimatedHours = t.estimatedHours || 2.5;
            });
          });
          return parsed;
        }
      }
    }
  } catch (err) {
    console.warn('AI curriculum generation note:', err.message);
  }

  // Robust Fallback Template for Custom Courses
  return {
    title: `Personalized ${goalClean} Master Roadmap`,
    description: `Tailored curriculum taking you from foundational concepts to advanced production skills in ${goalClean}.`,
    levels: [
      {
        id: 'level-1',
        title: `Level 1: Foundations of ${goalClean}`,
        order: 1,
        status: 'In Progress',
        isLocked: false,
        prerequisites: 'None',
        completionCriteria: `Master the foundational tools and primary syntax of ${goalClean}.`,
        topics: [
          {
            id: 'topic-1-1',
            title: `Core Principles & Architecture of ${goalClean}`,
            shortExplanation: `Introduction to the primary concepts, ecosystem, and tooling in ${goalClean}.`,
            learningObjectives: ['Understand the core mental model', 'Set up development workspace', 'Write your first implementation'],
            prerequisites: 'Basic computer literacy',
            exercisePrompt: `Implement a starter project demonstrating the basic workflow of ${goalClean}.`,
            requiresExercise: true,
            exerciseSubmitted: false,
            exerciseSubmissionText: '',
            exerciseStatus: 'pending',
            lessonCompleted: false,
            assessmentScore: null,
            requiredPassingScore: 70,
            weight: 1.0,
            estimatedHours: 2.5,
            status: 'Not Started'
          },
          {
            id: 'topic-1-2',
            title: `Essential Patterns & Data Flow in ${goalClean}`,
            shortExplanation: `Managing inputs, state, transformations, and standard conventions.`,
            learningObjectives: ['Organize modular structure', 'Handle errors and edge cases'],
            prerequisites: 'Core Principles',
            exercisePrompt: `Refactor your starter project to handle dynamic inputs and error states gracefully.`,
            requiresExercise: true,
            exerciseSubmitted: false,
            exerciseSubmissionText: '',
            exerciseStatus: 'pending',
            lessonCompleted: false,
            assessmentScore: null,
            requiredPassingScore: 70,
            weight: 1.1,
            estimatedHours: 3.0,
            status: 'Not Started'
          }
        ]
      },
      {
        id: 'level-2',
        title: `Level 2: Intermediate Implementation & Tooling`,
        order: 2,
        status: 'Locked',
        isLocked: true,
        prerequisites: `Level 1: Foundations of ${goalClean}`,
        completionCriteria: 'Build complete multi-component solutions and integrate standard libraries.',
        topics: [
          {
            id: 'topic-2-1',
            title: `Component Architecture & Best Practices`,
            shortExplanation: `Industry patterns for scalable codebase organization and reuse.`,
            learningObjectives: ['Design loosely coupled components', 'Apply SOLID engineering principles'],
            prerequisites: `Foundations of ${goalClean}`,
            exercisePrompt: `Build a modular component library adhering to separation of concerns.`,
            requiresExercise: true,
            exerciseSubmitted: false,
            exerciseSubmissionText: '',
            exerciseStatus: 'pending',
            lessonCompleted: false,
            assessmentScore: null,
            requiredPassingScore: 70,
            weight: 1.2,
            estimatedHours: 3.0,
            status: 'Not Started'
          }
        ]
      },
      {
        id: 'level-3',
        title: `Level 3: Advanced Optimization & Scaling`,
        order: 3,
        status: 'Locked',
        isLocked: true,
        prerequisites: `Level 2: Intermediate Implementation`,
        completionCriteria: 'Profile performance, eliminate bottlenecks, and implement security standards.',
        topics: [
          {
            id: 'topic-3-1',
            title: `Performance Profiling & Optimization`,
            shortExplanation: `Benchmarking execution times, memory usage, and eliminating performance bottlenecks.`,
            learningObjectives: ['Run automated benchmarks', 'Profile memory allocations'],
            prerequisites: 'Intermediate Implementation',
            exercisePrompt: 'Analyze a slow operation, identify the bottleneck, and achieve a measurable 50% performance improvement.',
            requiresExercise: true,
            exerciseSubmitted: false,
            exerciseSubmissionText: '',
            exerciseStatus: 'pending',
            lessonCompleted: false,
            assessmentScore: null,
            requiredPassingScore: 70,
            weight: 1.3,
            estimatedHours: 3.5,
            status: 'Not Started'
          }
        ]
      },
      {
        id: 'level-4',
        title: `Level 4: Real-World Capstone & Production Deployment`,
        order: 4,
        status: 'Locked',
        isLocked: true,
        prerequisites: `Level 3: Advanced Optimization`,
        completionCriteria: `Deploy an end-to-end production-ready capstone project in ${goalClean}.`,
        topics: [
          {
            id: 'topic-4-1',
            title: `Production Architecture & Testing`,
            shortExplanation: `Automated test suites, continuous delivery, and production environment monitoring.`,
            learningObjectives: ['Write end-to-end test cases', 'Deploy to cloud hosting environments'],
            prerequisites: 'Advanced Optimization',
            exercisePrompt: `Deploy your capstone project with automated testing and share the live URL or verification output.`,
            requiresExercise: true,
            exerciseSubmitted: false,
            exerciseSubmissionText: '',
            exerciseStatus: 'pending',
            lessonCompleted: false,
            assessmentScore: null,
            requiredPassingScore: 70,
            weight: 1.5,
            estimatedHours: 4.0,
            status: 'Not Started'
          }
        ]
      }
    ]
  };
}

/**
 * Master Curriculum Selector
 */
export async function getCurriculumForGoal(goalName = 'AI / Machine Learning Engineer', experienceLevel = 'beginner') {
  const g = (goalName || '').toLowerCase();

  if (g.includes('web') || g.includes('frontend') || g.includes('backend') || g.includes('fullstack') || g.includes('react') || g.includes('node')) {
    return {
      title: 'Full-Stack Web Development Master Roadmap',
      description: 'Comprehensive curriculum from HTML/CSS/JS fundamentals to React, Node.js, databases, security, and cloud deployment.',
      levels: getWebDevelopmentLevels()
    };
  }

  if (g.includes('devops') || g.includes('cloud') || g.includes('docker') || g.includes('kubernetes') || g.includes('sre') || g.includes('ci/cd') || g.includes('aws')) {
    return {
      title: 'DevOps & Cloud Engineering Master Roadmap',
      description: 'Production curriculum covering Linux internals, networking, Docker containerization, CI/CD pipelines, Kubernetes, and Terraform.',
      levels: getDevOpsLevels()
    };
  }

  if (g.includes('app') || g.includes('mobile') || g.includes('android') || g.includes('ios') || g.includes('flutter') || g.includes('react native') || g.includes('swift') || g.includes('kotlin')) {
    return {
      title: 'Mobile Application Development Master Roadmap',
      description: 'Modern cross-platform mobile curriculum covering UI layout, state management, offline databases, native device APIs, and app store publishing.',
      levels: getAppDevelopmentLevels()
    };
  }

  if (g.includes('cyber') || g.includes('security') || g.includes('hacking') || g.includes('penetration') || g.includes('owasp')) {
    return {
      title: 'Cybersecurity & Ethical Hacking Master Roadmap',
      description: 'Defense and offense mastery covering network analysis, OWASP Top 10 vulnerabilities, cryptography, and penetration testing.',
      levels: getCybersecurityLevels()
    };
  }

  if (g.includes('ai') || g.includes('machine learning') || g.includes('deep learning') || g.includes('data science') || g.includes('llm')) {
    // Return null to allow databaseService to use the default AI/ML roadmap
    return null;
  }

  // Any other custom course entered by the student!
  return await generateCustomCourseCurriculum(goalName, experienceLevel);
}
