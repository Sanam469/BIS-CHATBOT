const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'app', 'login', 'styles.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace tag selectors
css = css.replace(/^h1\s*\{/gm, '.login-wrapper h1 {');
css = css.replace(/^label\s*\{/gm, '.login-wrapper label {');
css = css.replace(/^input\[type="email"\],\s*\ninput\[type="password"\],\s*\ninput\[type="text"\]\s*\{/gm, 
  '.login-wrapper input[type="email"],\n.login-wrapper input[type="password"],\n.login-wrapper input[type="text"] {');
css = css.replace(/^input\[type="email"\]:focus,\s*\ninput\[type="password"\]:focus,\s*\ninput\[type="text"\]:focus\s*\{/gm, 
  '.login-wrapper input[type="email"]:focus,\n.login-wrapper input[type="password"]:focus,\n.login-wrapper input[type="text"]:focus {');
css = css.replace(/^input::placeholder\s*\{/gm, '.login-wrapper input::placeholder {');
css = css.replace(/^hr\s*\{/gm, '.login-wrapper hr {');
css = css.replace(/^\*,\s*\*\:\:before,\s*\*\:\:after\s*\{/gm, '.login-wrapper *, .login-wrapper *::before, .login-wrapper *::after {');

// General classes that might conflict like .hidden, .status, .toast, etc.
const classesToPrefix = [
  '.toast', '.toast-exit', '.status', '.hidden', '.btn-loading', '.modal', '.modal-content', '.modal-actions', '.cancel-btn', '.links', '.google-btn', '.divider', '.login-btn', '.login-form', '.input-group', '.brand', '.brand-logo', '.subtitle', '.login-container'
];

classesToPrefix.forEach(cls => {
    // Replace occurrences that begin at the start of a line
    const regex = new RegExp(`^(\\${cls}[\\s\\{:])`, 'gm');
    css = css.replace(regex, `.login-wrapper $1`);
});

fs.writeFileSync(cssPath, css);
console.log('Fixed CSS scoping');
