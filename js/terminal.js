/* ============================================================
   OVERFL0W — Cyberpunk Terminal Engine
   ============================================================ */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const output    = $('#output');
  const cmdInput  = $('#cmd-input');
  const termWrap  = $('#terminal-wrap');
  const clockEl   = $('#clock');
  const uptimeEl  = $('#uptime');
  const glitchOv  = $('#glitch-overlay');
  const promptEl  = $('#prompt-text');
  const mirrorEl  = $('#input-mirror');
  const ghostEl   = $('#ghost-text');
  const startTime = Date.now();

  const cmdHistory = [];
  let historyIdx = -1;
  let isRunning = false;

  /* ── Fake Filesystem ──────────────────────────────────── */

  const FS = {
    '/': {
      type: 'dir',
      children: ['home', 'sys', 'net', 'var'],
    },
    '/home': {
      type: 'dir',
      children: ['netrunner'],
    },
    '/home/netrunner': {
      type: 'dir',
      children: ['.identity', '.neural_config', 'dossier.txt', 'skills.dat', 'contracts'],
    },
    '/home/netrunner/.identity': {
      type: 'file',
      content: [
        'HANDLE:    MichaelOnline',
        'REALNAME:  Michael Daniello',
        'CLASS:     Software Engineer',
        'LOCATION:  Boston, MA // Night City East',
        'STATUS:    ACTIVE — ON THE GRID',
      ],
    },
    '/home/netrunner/.neural_config': {
      type: 'file',
      content: [
        'CYBERDECK_MODEL: Arasaka MK.V',
        'INTERFACE:       Kerenzikov v4.2',
        'RAM:             16 units',
        'BUFFER_SIZE:     12',
        'QUICKHACKS:      Ping, Short Circuit, Breach Protocol',
        'ICE_BYPASS:      ENABLED',
      ],
    },
    '/home/netrunner/dossier.txt': {
      type: 'file',
      content: [
        '═══════════════════════════════════════════',
        '  DOSSIER // CLASSIFIED',
        '═══════════════════════════════════════════',
        '',
        '  Building software on the edge of the net.',
        '  Crafting code. Shipping product. No corpo.',
        '',
        '  Reach me through the net:',
        '  → linkedin.com/in/michaeldaniello',
        '  → github.com/MichaelDaniello',
        '',
        '═══════════════════════════════════════════',
      ],
    },
    '/home/netrunner/skills.dat': {
      type: 'file',
      content: [
        'CAPABILITY SCAN RESULTS:',
        '',
        'LANGUAGES   ████████████████░░░░  Python · Go · JavaScript',
        'FRAMEWORKS  ██████████████░░░░░░  Flask · React · Node',
        'CLOUD       █████████████░░░░░░░  AWS · GCP · Terraform',
        'DEVOPS      ██████████████░░░░░░  Docker · CI/CD · K8s',
        'DATABASES   █████████████░░░░░░░  PostgreSQL · Redis · Mongo',
        'NETRUNNING  ████████████████████  ■■■ MAXED ■■■',
      ],
    },
    '/home/netrunner/contracts': {
      type: 'dir',
      children: ['arasaka_breach.log', 'militech_recon.log', 'README.md'],
    },
    '/home/netrunner/contracts/arasaka_breach.log': {
      type: 'file',
      content: [
        '[2077-03-12 02:14:07] Target: Arasaka subnet 10.77.0.0/16',
        '[2077-03-12 02:14:09] ICE detected — class BLACKWALL',
        '[2077-03-12 02:14:11] Deploying daemon: PING CASCADE',
        '[2077-03-12 02:14:15] Firewall bypassed. Extracting shard data...',
        '[2077-03-12 02:14:22] Exfiltration complete. 2.4TB secured.',
        '[2077-03-12 02:14:23] Connection terminated. No trace.',
      ],
    },
    '/home/netrunner/contracts/militech_recon.log': {
      type: 'file',
      content: [
        '[2077-05-01 19:30:44] Recon initiated on Militech R&D node',
        '[2077-05-01 19:30:48] Scanning ports 1-65535...',
        '[2077-05-01 19:31:02] 3 services exposed. Weak ICE detected.',
        '[2077-05-01 19:31:15] Personnel records accessed.',
        '[2077-05-01 19:31:20] Contract fulfilled. Payment: 15,000 eddies.',
      ],
    },
    '/home/netrunner/contracts/README.md': {
      type: 'file',
      content: [
        '# Contracts Archive',
        '',
        'Completed jobs for fixers across Night City.',
        'All data encrypted at rest. Eyes only.',
        '',
        'Current fixer: Rogue Amendiares',
      ],
    },
    '/sys': {
      type: 'dir',
      children: ['ice_protocols', 'kernel.dat', 'version.info'],
    },
    '/sys/ice_protocols': {
      type: 'dir',
      children: ['blackice.cfg', 'daemon_list.txt'],
    },
    '/sys/ice_protocols/blackice.cfg': {
      type: 'file',
      content: [
        'ICE_TYPE=BLACKWALL',
        'AGGRESSION=LETHAL',
        'TRACE_SPEED=0.3s',
        'COUNTER_HACK=ENABLED',
        'NEURAL_FEEDBACK=HIGH',
        '# DO NOT MODIFY — SYSTEM CRITICAL',
      ],
    },
    '/sys/ice_protocols/daemon_list.txt': {
      type: 'file',
      content: [
        'ACTIVE DAEMONS:',
        '  → Ping',
        '  → Short Circuit',
        '  → Contagion',
        '  → Overheat',
        '  → System Reset',
        '  → Cyberpsychosis (LOCKED — requires Lv.20)',
      ],
    },
    '/sys/kernel.dat': {
      type: 'file',
      content: [
        'CYBERDECK_OS KERNEL v2.0.77',
        'BUILD: 20770314-NIGHTCITY',
        'ARCH: neural-x86_64',
        'COMPILER: NetWatch GCC 13.3.7',
        'STATUS: STABLE',
      ],
    },
    '/sys/version.info': {
      type: 'file',
      content: [
        'OVERFL0W Terminal v2.0.77',
        'Cyberdeck OS — Night City Public Terminal',
        '© 2077 Independent Netrunner Collective',
      ],
    },
    '/net': {
      type: 'dir',
      children: ['github.lnk', 'linkedin.lnk', 'netwatch_alert.txt'],
    },
    '/net/github.lnk': {
      type: 'file',
      link: 'https://github.com/MichaelDaniello',
      content: [
        'NETWORK NODE: GitHub',
        'TARGET: github.com/MichaelDaniello',
        'STATUS: ONLINE',
        '',
        '→ github.com/MichaelDaniello',
      ],
    },
    '/net/linkedin.lnk': {
      type: 'file',
      link: 'https://www.linkedin.com/in/michaeldaniello/',
      content: [
        'NETWORK NODE: LinkedIn',
        'TARGET: linkedin.com/in/michaeldaniello',
        'STATUS: ONLINE',
        '',
        '→ linkedin.com/in/michaeldaniello',
      ],
    },
    '/net/netwatch_alert.txt': {
      type: 'file',
      content: [
        '⚠ NETWATCH ADVISORY — 2077.03.14',
        '',
        'Increased Blackwall anomalies detected in',
        'Night City sectors 7G through 12A.',
        '',
        'All netrunners advised to update ICE protocols.',
        'Report rogue AIs to your local fixer.',
      ],
    },
    '/var': {
      type: 'dir',
      children: ['logs'],
    },
    '/var/logs': {
      type: 'dir',
      children: ['session.log', 'access.log'],
    },
    '/var/logs/session.log': {
      type: 'file',
      content: [
        '[SESSION] Terminal accessed by visitor',
        '[SESSION] Neural handshake complete',
        '[SESSION] Encryption: AES-256-GCM',
        '[SESSION] Proxy: NightCity_Relay_7',
        '[SESSION] All commands are being logged.',
      ],
    },
    '/var/logs/access.log': {
      type: 'file',
      content: [
        '2077-03-10 04:12:01 — anonymous — DENIED',
        '2077-03-11 23:45:33 — v_vector — GRANTED',
        '2077-03-13 08:00:17 — alt.cunningham — GRANTED',
        '2077-03-14 12:30:55 — silverhand_j — DENIED (ICE triggered)',
        '2077-03-16 ??:??:?? — visitor — GRANTED (current)',
      ],
    },
  };

  let cwd = '/home/netrunner';

  function resolvePath(input) {
    if (!input || input === '~') return '/home/netrunner';
    if (input === '/') return '/';

    let parts;
    if (input.startsWith('/')) {
      parts = input.split('/').filter(Boolean);
    } else if (input.startsWith('~/')) {
      parts = ['home', 'netrunner', ...input.slice(2).split('/').filter(Boolean)];
    } else {
      parts = [...cwd.split('/').filter(Boolean), ...input.split('/').filter(Boolean)];
    }

    const resolved = [];
    for (const p of parts) {
      if (p === '.') continue;
      if (p === '..') { resolved.pop(); continue; }
      resolved.push(p);
    }
    return '/' + resolved.join('/');
  }

  function getPromptPath() {
    if (cwd === '/home/netrunner') return '~';
    if (cwd.startsWith('/home/netrunner/')) return '~' + cwd.slice('/home/netrunner'.length);
    return cwd;
  }

  function updatePrompt() {
    promptEl.innerHTML = `<span class="prompt-prefix">netrunner@overfl0w:${getPromptPath()}$</span>&nbsp;`;
  }

  /* ── ASCII Logo ───────────────────────────────────────── */

  const ASCII_LOGO = [
    '  ██████╗ ██╗   ██╗███████╗██████╗ ███████╗██╗      ██████╗ ██╗    ██╗',
    ' ██╔═══██╗██║   ██║██╔════╝██╔══██╗██╔════╝██║     ██╔═══██╗██║    ██║',
    ' ██║   ██║██║   ██║█████╗  ██████╔╝█████╗  ██║     ██║   ██║██║ █╗ ██║',
    ' ██║   ██║╚██╗ ██╔╝██╔══╝  ██╔══██╗██╔══╝  ██║     ██║   ██║██║███╗██║',
    ' ╚██████╔╝ ╚████╔╝ ███████╗██║  ██║██║     ███████╗╚██████╔╝╚███╔███╔╝',
    '  ╚═════╝   ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝',
  ].join('\n');

  /* ── Boot Sequence ────────────────────────────────────── */

  const BOOT_LINES = [
    { text: '', delay: 0 },
    { text: '  ┌─────────────────────────────────────────────────────┐', cls: 'dim', delay: 50 },
    { text: '    <span class="magenta">CYBERDECK OS v2.0.77</span> // NIGHT CITY PUBLIC TERMINAL', delay: 50 },
    { text: '    <span class="dim">Unauthorized access triggers ICE countermeasures.</span>', delay: 50 },
    { text: '    <span class="dim">All sessions logged. You have been warned, choom.</span>', delay: 50 },
    { text: '  └─────────────────────────────────────────────────────┘', cls: 'dim', delay: 50 },
    { text: '', delay: 0 },
  ];

  const INIT_LINES = [
    { text: '  <span class="dim">[INIT]</span> Neural interface handshake ......... <span class="success">SYNCED</span>', delay: 80 },
    { text: '  <span class="dim">[INIT]</span> Encrypting uplink .................. <span class="success">AES-256</span>', delay: 80 },
    { text: '  <span class="dim">[INIT]</span> Bypassing corporate ICE ............ <span class="success">CLEAN</span>', delay: 80 },
    { text: '  <span class="dim">[INIT]</span> Loading persona: <span class="highlight">M.DANIELLO</span> ....... <span class="success">LOADED</span>', delay: 80 },
    { text: '  <span class="dim">[INIT]</span> Mounting filesystem ................ <span class="success">OK</span>', delay: 80 },
    { text: '  <span class="dim">[INIT]</span> Routing through NightCity proxy .... <span class="success">ONLINE</span>', delay: 80 },
    { text: '', delay: 0 },
    { text: '  Connection established. Welcome to <span class="highlight">OVERFL0W</span>, netrunner.', delay: 40 },
    { text: '  This is the personal node of <span class="highlight">Michael Daniello</span>.', delay: 40 },
    { text: '', delay: 0 },
    { text: '  Type <span class="highlight">help</span> to jack in.', delay: 40 },
    { text: '', delay: 0 },
  ];

  /* ── Commands ─────────────────────────────────────────── */

  const COMMANDS = {

    help: {
      desc: 'Available commands',
      run: () => [
        '',
        '  <span class="highlight">─── COMMAND DIRECTORY ───</span>',
        '',
        '  <span class="highlight">whoami</span>      Operator dossier',
        '  <span class="highlight">skills</span>      Technical capability scan',
        '  <span class="highlight">contact</span>     Secure communication channels',
        '  <span class="highlight">status</span>      System diagnostics',
        '  <span class="highlight">hack</span>        Attempt to breach mainframe',
        '',
        '  <span class="highlight">─── ARCADE ───</span>',
        '',
        '  <span class="highlight">darkfort</span>    Boot DARK FORT // a Mörk Borg dungeon crawl',
        '              <span class="dim">aliases: game, play</span>',
        '',
        '  <span class="highlight">─── FILESYSTEM ───</span>',
        '',
        '  <span class="highlight">pwd</span>         Print working directory',
        '  <span class="highlight">ls</span>          List directory contents',
        '  <span class="highlight">cd</span> <span class="dim">&lt;dir&gt;</span>    Change directory',
        '  <span class="highlight">cat</span> <span class="dim">&lt;file&gt;</span>  Read file contents',
        '  <span class="highlight">clear</span>       Purge terminal buffer',
        '',
      ],
    },

    whoami: {
      desc: 'Operator dossier',
      run: () => [
        '',
        '  ┌────────────────────────────────────────────────┐',
        '  │  <span class="magenta">DOSSIER // CLASSIFIED</span>                        │',
        '  ├────────────────────────────────────────────────┤',
        '  │                                                │',
        '  │  HANDLE:    <span class="highlight">MichaelOnline</span>                     │',
        '  │  REALNAME:  Michael Daniello                   │',
        '  │  CLASS:     Software Engineer                  │',
        '  │  LOCATION:  Boston, MA // Night City East      │',
        '  │  STATUS:    <span class="success">ACTIVE — ON THE GRID</span>              │',
        '  │                                                │',
        '  │  <span class="dim">Building software on the edge of the net.</span>     │',
        '  │  <span class="dim">Crafting code. Shipping product. No corpo.</span>     │',
        '  │                                                │',
        '  └────────────────────────────────────────────────┘',
        '',
      ],
    },

    skills: {
      desc: 'Technical capabilities',
      run: () => [
        '',
        '  <span class="magenta">─── CAPABILITY SCAN ───</span>',
        '',
        '  LANGUAGES   <span class="success">████████████████</span><span class="dim">░░░░</span>  Python · Go · JavaScript',
        '  FRAMEWORKS  <span class="success">██████████████</span><span class="dim">░░░░░░</span>  Flask · React · Node',
        '  CLOUD       <span class="success">█████████████</span><span class="dim">░░░░░░░</span>  AWS · GCP · Terraform',
        '  DEVOPS      <span class="success">██████████████</span><span class="dim">░░░░░░</span>  Docker · CI/CD · K8s',
        '  DATABASES   <span class="success">█████████████</span><span class="dim">░░░░░░░</span>  PostgreSQL · Redis · Mongo',
        '  NETRUNNING  <span class="success">████████████████████</span>  <span class="highlight">■■■ MAXED ■■■</span>',
        '',
      ],
    },

    contact: {
      desc: 'Secure channels',
      run: () => [
        '',
        '  <span class="magenta">─── SECURE CHANNELS ───</span>',
        '',
        '  <span class="magenta">[01]</span>  LinkedIn  →  <a href="https://www.linkedin.com/in/michaeldaniello/" target="_blank" rel="noopener">linkedin.com/in/michaeldaniello</a>',
        '  <span class="magenta">[02]</span>  GitHub    →  <a href="https://github.com/MichaelDaniello" target="_blank" rel="noopener">github.com/MichaelDaniello</a>',
        '',
        '  <span class="dim">Messages are end-to-end encrypted. Probably.</span>',
        '',
      ],
    },

    status: {
      desc: 'System diagnostics',
      run: () => {
        const upSec = Math.floor((Date.now() - startTime) / 1000);
        const mem = (Math.random() * 30 + 40).toFixed(1);
        const cpu = (Math.random() * 15 + 5).toFixed(1);
        const temp = (Math.random() * 10 + 62).toFixed(1);
        return [
          '',
          '  <span class="magenta">─── SYSTEM DIAGNOSTICS ───</span>',
          '',
          `  UPTIME:      ${formatUptime(upSec)}`,
          `  MEMORY:      ${mem}% <span class="dim">[${parseFloat(mem) < 70 ? '<span class="success">NOMINAL</span>' : '<span class="orange">ELEVATED</span>'}]</span>`,
          `  CPU LOAD:    ${cpu}% <span class="dim">[<span class="success">NOMINAL</span>]</span>`,
          `  CORE TEMP:   ${temp}°C`,
          '  ICE STATUS:  <span class="success">NO THREATS</span>',
          '  PROXY:       NightCity_Relay_7 <span class="success">▲</span>',
          `  CWD:         ${cwd}`,
          `  COMMANDS:    ${cmdHistory.length} executed this session`,
          '',
        ];
      },
    },

    darkfort: {
      desc: 'Boot DARK FORT dungeon crawl',
      run: () => {
        // hand off to the game; the lines below show while the page swaps
        setTimeout(() => { window.location.href = 'darkfort/index.html'; }, 900);
        return [
          '',
          '  <span class="magenta">─── LOADING CARTRIDGE: DARK_FORT.rom ───</span>',
          '',
          '  <span class="dim">decrypting catacomb tiles..............</span> <span class="success">OK</span>',
          '  <span class="dim">summoning 2d6 room geometry............</span> <span class="success">OK</span>',
          '  <span class="dim">rolling d4 for doors...................</span> <span class="success">OK</span>',
          '  <span class="dim">waking the necro-sorcerer..............</span> <span class="orange">UNHOLY</span>',
          '',
          '  <span class="highlight">THE 7TH MISERY APPROACHES.</span> Descend, Kargunt...',
          '',
        ];
      },
    },

    game: { hidden: true, desc: 'alias: darkfort', run: (a) => COMMANDS.darkfort.run(a) },
    play: { hidden: true, desc: 'alias: darkfort', run: (a) => COMMANDS.darkfort.run(a) },

    pwd: {
      desc: 'Print working directory',
      run: () => ['', `  ${cwd}`, ''],
    },

    ls: {
      desc: 'List directory',
      run: (args) => {
        const target = args ? resolvePath(args) : cwd;
        const node = FS[target];
        if (!node) return ['', `  <span class="error">ls: cannot access '${escapeHtml(args || '')}': No such file or directory</span>`, ''];
        if (node.type !== 'dir') return ['', `  <span class="error">ls: '${escapeHtml(args)}' is not a directory</span>`, ''];

        const lines = [''];
        const entries = node.children.map(name => {
          const childPath = target === '/' ? '/' + name : target + '/' + name;
          const child = FS[childPath];
          const isDir = child && child.type === 'dir';
          return isDir
            ? `  <span class="dir-entry">${name}/</span>`
            : (name.endsWith('.lnk')
                ? `  <span class="highlight">${name}</span>`
                : `  <span class="file-entry">${name}</span>`);
        });
        lines.push(...entries);
        lines.push('');
        return lines;
      },
    },

    cd: {
      desc: 'Change directory',
      run: (args) => {
        const target = resolvePath(args);
        const node = FS[target];
        if (!node) return ['', `  <span class="error">cd: no such directory: ${escapeHtml(args || '')}</span>`, ''];
        if (node.type !== 'dir') return ['', `  <span class="error">cd: not a directory: ${escapeHtml(args)}</span>`, ''];
        cwd = target;
        updatePrompt();
        return null;
      },
    },

    cat: {
      desc: 'Read file',
      run: (args) => {
        if (!args) return ['', '  <span class="error">cat: missing operand</span>', ''];
        const target = resolvePath(args);
        const node = FS[target];
        if (!node) return ['', `  <span class="error">cat: ${escapeHtml(args)}: No such file or directory</span>`, ''];
        if (node.type === 'dir') return ['', `  <span class="error">cat: ${escapeHtml(args)}: Is a directory</span>`, ''];

        const lines = [''];
        for (const line of node.content) {
          if (node.link && line.startsWith('→')) {
            lines.push(`  <a href="${node.link}" target="_blank" rel="noopener">${line}</a>`);
          } else {
            lines.push(`  ${line}`);
          }
        }
        lines.push('');
        return lines;
      },
    },

    clear: {
      desc: 'Clear terminal',
      run: () => 'CLEAR',
    },

    banner: {
      desc: 'Redisplay banner',
      hidden: true,
      run: () => 'BANNER',
    },

    hack: {
      desc: 'Attempt mainframe breach',
      run: () => 'HACK',
    },
  };

  const COMMAND_NAMES = Object.keys(COMMANDS);
  const VISIBLE_COMMANDS = COMMAND_NAMES.filter(c => !COMMANDS[c].hidden);

  /* ── Helpers ──────────────────────────────────────────── */

  function scrollToBottom() {
    termWrap.scrollTop = termWrap.scrollHeight;
  }

  function addLine(html, cls) {
    const div = document.createElement('div');
    div.className = 'line' + (cls ? ' ' + cls : '');
    div.innerHTML = html;
    output.appendChild(div);
    scrollToBottom();
  }

  function addAscii(text) {
    const div = document.createElement('div');
    div.className = 'line ascii-art glitch-art';
    div.setAttribute('data-text', text);
    div.textContent = text;
    output.appendChild(div);
    scrollToBottom();
  }

  async function typeLines(lines) {
    for (const l of lines) {
      await sleep(l.delay || 30);
      addLine(l.text, l.cls || '');
    }
  }

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatUptime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h ? h + 'h ' : ''}${m ? m + 'm ' : ''}${s}s`;
  }

  function getPrompt() {
    return `<span class="prompt-prefix">netrunner@overfl0w:${getPromptPath()}$</span> `;
  }

  /* ── Hack Easter Egg ──────────────────────────────────── */

  async function hackSequence() {
    addLine('');
    addLine('  <span class="orange">INITIATING BREACH PROTOCOL...</span>');
    await sleep(400);

    const steps = [
      'Scanning ports 1-65535 ........',
      'Probing firewall gaps .........',
      'Injecting daemon payload ......',
      'Escalating privileges .........',
      'Decrypting access tokens ......',
      'Bypassing Blackwall shard .....',
    ];

    for (const step of steps) {
      addLine(`  <span class="dim">[HACK]</span> ${step} <span class="success">▓</span>`);
      await sleep(250 + Math.random() * 350);
    }

    await sleep(200);
    addLine('');
    addLine('  <span class="error">▓▓▓ ICE COUNTERMEASURE TRIGGERED ▓▓▓</span>');
    addLine('  <span class="error">COUNTER-TRACE IN PROGRESS — NEURAL FEEDBACK DETECTED</span>');
    await sleep(600);

    glitchOv.classList.remove('hidden');
    await sleep(2500);
    glitchOv.classList.add('hidden');

    addLine('');
    addLine('  <span class="dim">Connection re-established. Nice try, choom.</span>');
    addLine('');
  }

  /* ── Tab Completion ───────────────────────────────────── */

  function getCompletions(input) {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (parts.length <= 1) {
      return {
        type: 'command',
        matches: COMMAND_NAMES.filter(c => c.startsWith(cmd)),
        partial: cmd,
      };
    }

    if (['cd', 'ls', 'cat'].includes(cmd)) {
      const arg = parts.slice(1).join(' ');
      const lastSlash = arg.lastIndexOf('/');
      let dirPart, filePart;

      if (lastSlash >= 0) {
        dirPart = arg.slice(0, lastSlash + 1);
        filePart = arg.slice(lastSlash + 1);
      } else {
        dirPart = '';
        filePart = arg;
      }

      const dirPath = resolvePath(dirPart || '.');
      const node = FS[dirPath];
      if (!node || node.type !== 'dir') return { type: 'path', matches: [], partial: filePart };

      const matches = node.children.filter(c => c.startsWith(filePart)).map(c => {
        const childPath = dirPath === '/' ? '/' + c : dirPath + '/' + c;
        const isDir = FS[childPath] && FS[childPath].type === 'dir';
        return { name: c, isDir };
      });

      return { type: 'path', matches, partial: filePart, prefix: cmd + ' ' + dirPart };
    }

    return { type: 'none', matches: [] };
  }

  function updateGhostText(input) {
    if (!input.trim()) {
      ghostEl.textContent = '';
      return;
    }

    const completions = getCompletions(input);
    if (completions.matches.length === 0) {
      ghostEl.textContent = '';
      return;
    }

    let bestMatch = '';
    if (completions.type === 'command') {
      const exact = completions.matches.find(m => m === input.trim().toLowerCase());
      if (exact) { ghostEl.textContent = ''; return; }
      bestMatch = completions.matches[0].slice(completions.partial.length);
    } else if (completions.type === 'path') {
      const m = completions.matches[0];
      if (m.name === completions.partial) { ghostEl.textContent = ''; return; }
      const suffix = m.isDir ? '/' : '';
      bestMatch = m.name.slice(completions.partial.length) + suffix;
    }

    ghostEl.textContent = bestMatch;
  }

  function tabComplete(input) {
    const completions = getCompletions(input);

    if (completions.type === 'command' && completions.matches.length === 1) {
      cmdInput.value = completions.matches[0];
    } else if (completions.type === 'path' && completions.matches.length === 1) {
      const m = completions.matches[0];
      const suffix = m.isDir ? '/' : '';
      cmdInput.value = (completions.prefix || completions.partial) + m.name + suffix;
    } else if (completions.matches.length > 1) {
      let common;
      if (completions.type === 'command') {
        common = findCommonPrefix(completions.matches);
        if (common.length > completions.partial.length) {
          cmdInput.value = common;
        }
      } else {
        const names = completions.matches.map(m => m.name);
        common = findCommonPrefix(names);
        if (common.length > completions.partial.length) {
          cmdInput.value = (completions.prefix || '') + common;
        }
      }
    }
    syncMirror();
    updateGhostText(cmdInput.value);
  }

  function findCommonPrefix(strings) {
    if (!strings.length) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }

  /* ── Process Command ──────────────────────────────────── */

  async function processCommand(raw) {
    if (isRunning) return;

    addLine(`${getPrompt()}<span class="cmd-text">${escapeHtml(raw)}</span>`);
    ghostEl.textContent = '';

    const trimmed = raw.trim();
    if (trimmed) {
      cmdHistory.unshift(trimmed);
      historyIdx = -1;
    }

    if (!trimmed) return;

    const spaceIdx = trimmed.indexOf(' ');
    const cmd = (spaceIdx > -1 ? trimmed.slice(0, spaceIdx) : trimmed).toLowerCase();
    const args = spaceIdx > -1 ? trimmed.slice(spaceIdx + 1).trim() : '';

    if (cmd === 'clear') {
      output.innerHTML = '';
      return;
    }

    if (cmd === 'banner') {
      addAscii(ASCII_LOGO);
      return;
    }

    if (cmd === 'hack') {
      isRunning = true;
      cmdInput.disabled = true;
      await hackSequence();
      cmdInput.disabled = false;
      cmdInput.focus();
      isRunning = false;
      return;
    }

    const handler = COMMANDS[cmd];
    if (handler && handler.run) {
      const result = handler.run(args);
      if (Array.isArray(result)) {
        result.forEach(line => addLine(line));
      }
    } else {
      const inputLine = $('#input-line');
      inputLine.classList.add('input-reject');
      setTimeout(() => inputLine.classList.remove('input-reject'), 400);

      addLine('');
      addLine(`  <span class="error">ERR:</span> unknown command: <span class="highlight">${escapeHtml(cmd)}</span>`);
      addLine(`  Type <span class="highlight">help</span> for available commands.`);
      addLine('');
    }
  }

  /* ── Input Handling ───────────────────────────────────── */

  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = cmdInput.value;
      cmdInput.value = '';
      syncMirror();
      ghostEl.textContent = '';
      processCommand(val);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      tabComplete(cmdInput.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length && historyIdx < cmdHistory.length - 1) {
        historyIdx++;
        cmdInput.value = cmdHistory[historyIdx];
        syncMirror();
        ghostEl.textContent = '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx > 0) {
        historyIdx--;
        cmdInput.value = cmdHistory[historyIdx];
      } else {
        historyIdx = -1;
        cmdInput.value = '';
      }
      syncMirror();
      ghostEl.textContent = '';
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      output.innerHTML = '';
    }
  });

  function syncMirror() {
    mirrorEl.textContent = cmdInput.value;
  }

  cmdInput.addEventListener('input', () => {
    syncMirror();
    updateGhostText(cmdInput.value);
  });

  document.addEventListener('click', (e) => {
    if (e.target.tagName !== 'A') cmdInput.focus();
  });

  /* ── Clock / Uptime ───────────────────────────────────── */

  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    uptimeEl.textContent = 'SES: ' + formatUptime(elapsed);
  }

  setInterval(updateClock, 1000);
  updateClock();

  /* ── Boot ─────────────────────────────────────────────── */

  async function boot() {
    const inputLine = $('#input-line');
    inputLine.classList.add('hidden');
    cmdInput.disabled = true;
    addAscii(ASCII_LOGO);
    await sleep(400);
    await typeLines(BOOT_LINES);
    await typeLines(INIT_LINES);
    updatePrompt();
    inputLine.classList.remove('hidden');
    cmdInput.disabled = false;
    cmdInput.focus();
    scrollToBottom();
  }

  boot();

})();
