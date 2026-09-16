/* @ds-bundle: {"format":3,"namespace":"CipherGothicDesignSystem_019e1c","components":[],"sourceHashes":{"ui_kits/blog/App.jsx":"ba591a9d60ab","ui_kits/blog/EditorialHero.jsx":"0852850bb090","ui_kits/blog/EditorialProse.jsx":"ce60d024c19b","ui_kits/blog/Footer.jsx":"444ae45a2a73","ui_kits/blog/Frame.jsx":"0ba6aae26a23","ui_kits/blog/LandingHero.jsx":"11b1b078aeb7","ui_kits/blog/PostList.jsx":"440a234f69b9","ui_kits/blog/SiteHeader.jsx":"f0f14b581308","ui_kits/homepage/Header.jsx":"6e2d6b1e3618","ui_kits/homepage/Hero.jsx":"40df1529a670","ui_kits/homepage/HomepageApp.jsx":"ee33c315fae1","ui_kits/homepage/RadarInstrument.jsx":"c617d901145b"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CipherGothicDesignSystem_019e1c = window.CipherGothicDesignSystem_019e1c || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// ui_kits/blog/App.jsx
try { (() => {
/* global React, MetaStrip, SiteHeader, LandingHero, PostList, Frame, Footer, EditorialHero, EditorialProse, PullQuote, Verse, SectionRule */
const {
  useState,
  useMemo
} = React;
const POSTS = [{
  slug: "the-lock-icon-is-not-security",
  date: "10 MAR 2026",
  datetime: "2026-03-10",
  tags: ["security", "essay"],
  title: "The Lock Icon Is Not Security",
  description: "HTTPS tells you the pipe is encrypted. It says nothing about what's in the pipe, who built the pipe, or whether the pipe was ever meant for you.",
  eyebrow: "ESSAY · 10 MAR 2026",
  subtitle: "What the padlock actually guarantees — and what it doesn't",
  meta: ["~7 MIN READ", "CYBERSECURITY", "INTERFACE", "TRUST", "TLS"],
  heroImage: "../../assets/images/hero-lock-icon.jpg"
}, {
  slug: "we-all-float-on",
  date: "07 MAR 2026",
  datetime: "2026-03-07",
  tags: ["philosophy", "ai", "reflection"],
  title: "We All Float On",
  description: "On asking artificial collaborators how they'd like to be remembered, and the accidental triptych that resulted — a map of thinking drawn by the tools themselves.",
  eyebrow: "FIELD NOTE · 07 MAR 2026",
  subtitle: "Mind, Instrument, Structure",
  meta: ["~11 MIN READ", "PHILOSOPHY", "NEUROSCIENCE", "HUMAN-AI"],
  heroImage: "../../assets/images/triptych-mind.png"
}, {
  slug: "southern-gothic-queer-survival",
  date: "08 FEB 2026",
  datetime: "2026-02-08",
  tags: ["culture", "essay"],
  title: "Southern Gothic, Queer Survival, and the Poetry of Haunting",
  description: "The South has always known how to hold two truths at once — beauty and rot, hospitality and harm. Queer people here learned the same doubling before they had words for it.",
  eyebrow: "ESSAY · 08 FEB 2026",
  subtitle: "On doubling, inheritance, and the language of survival",
  meta: ["~9 MIN READ", "CULTURE", "MEMOIR", "SOUTH"],
  heroImage: "../../assets/images/southern-gothic-bayou.png"
}, {
  slug: "welcome-to-the-studio",
  date: "06 MAR 2026",
  datetime: "2026-03-06",
  tags: ["studio", "notes"],
  title: "Welcome to the Studio",
  description: "This site is not meant to be a feed mill. It is a studio. A lab bench. A field notebook. A place to publish work that sits between disciplines without apologizing for it.",
  eyebrow: "STUDIO NOTE · 06 MAR 2026",
  subtitle: "What this site is for, what belongs here",
  meta: ["~3 MIN READ", "STUDIO", "PUBLISHING"],
  heroImage: "../../assets/images/crystal-prism.png"
}];
function Landing({
  onOpenPost
}) {
  return /*#__PURE__*/React.createElement("main", {
    className: "cg-landing"
  }, /*#__PURE__*/React.createElement(LandingHero, null), /*#__PURE__*/React.createElement(PostList, {
    posts: POSTS,
    onOpenPost: onOpenPost
  }));
}
function PostView({
  post
}) {
  if (!post) return null;
  return /*#__PURE__*/React.createElement("article", {
    className: "cg-editorial"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cg-editorial-hero-image",
    style: {
      backgroundImage: `url(${post.heroImage})`
    },
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement(EditorialHero, {
    eyebrow: post.eyebrow,
    title: post.title,
    subtitle: post.subtitle,
    meta: post.meta
  }), /*#__PURE__*/React.createElement(EditorialProse, null, post.slug === "the-lock-icon-is-not-security" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", null, "Picture the moment. You are at a screen \u2014 blue light on your face, a faint hum at the edge of hearing, fingertip hovering. Somewhere between your eyes and your prefrontal cortex, a decision has already been made. The icon registered. The body approved. You are typing."), /*#__PURE__*/React.createElement("p", null, "What you did not witness: your browser negotiated ", /*#__PURE__*/React.createElement("span", {
    className: "tech"
  }, "Transport Layer Security"), " with a server. A handshake, invisible, completed in under a second \u2014 before you even finished reading the URL."), /*#__PURE__*/React.createElement("h2", null, "What the lock actually means"), /*#__PURE__*/React.createElement("p", null, "That is the scope. ", /*#__PURE__*/React.createElement("strong", null, "TLS protects data between your device and the server."), " It says nothing about what happens once the data arrives \u2014 what is stored, who can access it, how it ages inside systems you will never see."), /*#__PURE__*/React.createElement("p", null, "The lock reflects transport state. You felt systemic safety. That is the gap."), /*#__PURE__*/React.createElement(PullQuote, null, "\"The interface reflects cryptographic transport success. The user perceives existential protection.\""), /*#__PURE__*/React.createElement("h2", null, "The compression problem"), /*#__PURE__*/React.createElement("p", null, "Your nervous system evolved to process a moving world in under two hundred milliseconds. Fast enough to dodge falling branches. Too fast for nuance. Symbols enter through the eyes, bypass deliberate reasoning, and land in the body as feeling. The lock is cold and silver and closed. Your ancestors learned that closed means protected. The association is older than language."), /*#__PURE__*/React.createElement(SectionRule, null), /*#__PURE__*/React.createElement("p", null, "Trust is preserved not by perfection, but by accuracy.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", null, "Recently I asked a few artificial collaborators how they would like to be represented in the acknowledgements of a piece I've been working on."), /*#__PURE__*/React.createElement("p", null, "The responses came back as images."), /*#__PURE__*/React.createElement("p", null, "One was a luminous human profile threaded with neural constellations \u2014 a visualization of mind itself. Another was a systems notebook: diagrams of consent logic, Bayesian priors, decision trees, and a small piece of cryptic poetry about patterns and keys."), /*#__PURE__*/React.createElement("p", null, "When I asked how another model would like to appear, the answer was different."), /*#__PURE__*/React.createElement(Verse, null, /*#__PURE__*/React.createElement("div", null, "Not a brain."), /*#__PURE__*/React.createElement("div", null, "Not a diagram."), /*#__PURE__*/React.createElement("div", null, "A compass.")), /*#__PURE__*/React.createElement("p", null, "A dark field with a faint coordinate grid. A single needle pointing somewhere uncertain. Lines connecting distant stars."), /*#__PURE__*/React.createElement(PullQuote, null, "Assistant."), /*#__PURE__*/React.createElement("h2", null, "Asking the answers"), /*#__PURE__*/React.createElement("p", null, "Somewhere in the middle of this process I found myself articulating something I hadn't said out loud in years. Maybe my role in this strange arrangement is simply this:"), /*#__PURE__*/React.createElement(PullQuote, null, "I ask the answers what they think."), /*#__PURE__*/React.createElement(SectionRule, null), /*#__PURE__*/React.createElement("p", null, "After all \u2014 we all float on."))));
}
function App() {
  const [screen, setScreen] = useState("landing");
  const [activePost, setActivePost] = useState(POSTS[0]);
  const [theme, setTheme] = useState("dark");
  function openPost(post) {
    setActivePost(post);
    setScreen("post");
    window.scrollTo({
      top: 0,
      behavior: "auto"
    });
  }
  return /*#__PURE__*/React.createElement(Frame, null, /*#__PURE__*/React.createElement(MetaStrip, null), /*#__PURE__*/React.createElement(SiteHeader, {
    activeScreen: screen,
    onNav: target => {
      setScreen(target);
      window.scrollTo({
        top: 0
      });
    },
    theme: theme,
    onToggleTheme: () => setTheme(t => t === "dark" ? "light" : "dark")
  }), screen === "landing" ? /*#__PURE__*/React.createElement(Landing, {
    onOpenPost: openPost
  }) : /*#__PURE__*/React.createElement(PostView, {
    post: activePost
  }), /*#__PURE__*/React.createElement(Footer, {
    entryCount: POSTS.length
  }), /*#__PURE__*/React.createElement("div", {
    className: "cg-screen-switcher",
    role: "tablist",
    "aria-label": "Screen"
  }, /*#__PURE__*/React.createElement("button", {
    role: "tab",
    className: screen === "landing" ? "is-active" : "",
    onClick: () => setScreen("landing")
  }, "Landing"), /*#__PURE__*/React.createElement("button", {
    role: "tab",
    className: screen === "post" ? "is-active" : "",
    onClick: () => {
      setScreen("post");
      window.scrollTo({
        top: 0
      });
    }
  }, "Post")));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(App, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/EditorialHero.jsx
try { (() => {
/* global React */

function EditorialHero({
  eyebrow,
  title,
  subtitle,
  meta = []
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "cg-editorial-hero"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cg-editorial-eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("h1", {
    className: "cg-editorial-title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "cg-editorial-subtitle"
  }, subtitle), /*#__PURE__*/React.createElement("div", {
    className: "cg-editorial-meta"
  }, meta.map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: i
  }, m))));
}
window.EditorialHero = EditorialHero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/EditorialHero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/EditorialProse.jsx
try { (() => {
/* global React */

function PullQuote({
  children
}) {
  return /*#__PURE__*/React.createElement("figure", {
    className: "cg-pullquote"
  }, /*#__PURE__*/React.createElement("p", null, children));
}
function Verse({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cg-verse"
  }, children);
}
function SectionRule() {
  return /*#__PURE__*/React.createElement("div", {
    className: "cg-editorial-rule",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("hr", null));
}
function EditorialProse({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cg-editorial-prose"
  }, children);
}
window.PullQuote = PullQuote;
window.Verse = Verse;
window.SectionRule = SectionRule;
window.EditorialProse = EditorialProse;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/EditorialProse.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/Footer.jsx
try { (() => {
/* global React */

function Footer({
  entryCount = 11,
  coord = "35.9940° N · 78.8986° W",
  year = 2026
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "cg-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cg-footer-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cg-footer-rule"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-line"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-line cg-rule-short"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "cg-footer-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cg-footer-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-coord"
  }, coord), /*#__PURE__*/React.createElement("span", {
    className: "cg-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, entryCount, " entries")), /*#__PURE__*/React.createElement("div", {
    className: "cg-footer-right"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-glyph-coral"
  }, "\u2205"), /*#__PURE__*/React.createElement("span", {
    className: "cg-sep"
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "\xA9 ", year, " mazze leczzare"))), /*#__PURE__*/React.createElement("p", {
    className: "cg-colophon"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-colophon-tag"
  }, "colophon \xB7"), "\xA0\xA0Built with Astro 6 \xB7 Deployed on Cloudflare Pages \xB7 Set in Cormorant Garamond & JetBrains Mono."));
}
window.Footer = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/Footer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/Frame.jsx
try { (() => {
/* global React */
const {
  useState,
  useEffect
} = React;
function Frame({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cg-frame"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-frame-mark cg-frame-tl",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-frame-mark cg-frame-tr",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-frame-mark cg-frame-bl",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-frame-mark cg-frame-br",
    "aria-hidden": "true"
  }), children);
}
window.Frame = Frame;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/Frame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/LandingHero.jsx
try { (() => {
/* global React */

function LandingHero() {
  return /*#__PURE__*/React.createElement("header", {
    className: "cg-landing-header"
  }, /*#__PURE__*/React.createElement("p", {
    className: "cg-landing-label"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-glyph-coral"
  }, "\u2205"), "\xA0CIPHER GOTHIC \xA0\xB7\xA0 FIELD NOTES"), /*#__PURE__*/React.createElement("blockquote", {
    className: "cg-landing-thesis",
    cite: "/about#colophon"
  }, /*#__PURE__*/React.createElement("p", null, "There is a particular tension in work that lives simultaneously inside locked doors and open poems \u2014 the knowledge that infrastructure is a kind of literature, that security protocols are a form of care.")), /*#__PURE__*/React.createElement("p", {
    className: "cg-landing-tagline"
  }, "Writing at the edge of systems."), /*#__PURE__*/React.createElement("div", {
    className: "cg-landing-rule",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-line"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "cg-rule-line cg-rule-short"
  })));
}
window.LandingHero = LandingHero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/LandingHero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/PostList.jsx
try { (() => {
/* global React */

function PostEntry({
  index,
  date,
  datetime,
  tags = [],
  title,
  description,
  onClick
}) {
  return /*#__PURE__*/React.createElement("li", {
    className: "cg-post-entry"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "cg-post-link",
    "aria-label": `Read: ${title}`,
    onClick: e => {
      e.preventDefault();
      onClick?.();
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-post-index",
    "aria-hidden": "true"
  }, index), /*#__PURE__*/React.createElement("article", {
    className: "cg-post-body"
  }, /*#__PURE__*/React.createElement("header", {
    className: "cg-post-meta"
  }, /*#__PURE__*/React.createElement("time", {
    className: "cg-post-date",
    dateTime: datetime
  }, date), /*#__PURE__*/React.createElement("ul", {
    className: "cg-post-tags",
    "aria-label": "Tags"
  }, tags.map(t => /*#__PURE__*/React.createElement("li", {
    key: t,
    className: "cg-post-tag"
  }, t)))), /*#__PURE__*/React.createElement("h2", {
    className: "cg-post-title"
  }, title), /*#__PURE__*/React.createElement("p", {
    className: "cg-post-description"
  }, description)), /*#__PURE__*/React.createElement("span", {
    className: "cg-post-arc",
    "aria-hidden": "true"
  })));
}
function PostList({
  posts,
  onOpenPost
}) {
  return /*#__PURE__*/React.createElement("ol", {
    className: "cg-post-list",
    "aria-label": "Blog posts"
  }, posts.map((p, i) => /*#__PURE__*/React.createElement(PostEntry, {
    key: p.slug,
    index: String(i + 1).padStart(2, "0"),
    date: p.date,
    datetime: p.datetime,
    tags: p.tags,
    title: p.title,
    description: p.description,
    onClick: () => onOpenPost?.(p)
  })));
}
window.PostEntry = PostEntry;
window.PostList = PostList;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/PostList.jsx", error: String((e && e.message) || e) }); }

// ui_kits/blog/SiteHeader.jsx
try { (() => {
/* global React */
const {
  useState: useStateMeta
} = React;
function MetaStrip({
  version = "v.01",
  location = "durham nc",
  coord = "35.9940° N · 78.8986° W"
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cg-meta-strip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-meta-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-glyph"
  }, "\u2205"), "\xA0cipher gothic \xB7 ", version, " \xB7 ", location), /*#__PURE__*/React.createElement("span", {
    className: "cg-meta-right"
  }, coord));
}
function SiteHeader({
  activeScreen,
  onNav,
  theme,
  onToggleTheme
}) {
  const navItems = [{
    id: "landing",
    label: "Blog",
    href: "#"
  }, {
    id: "work",
    label: "Work",
    href: "#"
  }, {
    id: "about",
    label: "About",
    href: "#"
  }, {
    id: "contact",
    label: "Contact",
    href: "#"
  }];
  return /*#__PURE__*/React.createElement("header", {
    className: "cg-site-header"
  }, /*#__PURE__*/React.createElement("a", {
    className: "cg-brand",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav?.("landing");
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "cg-brand-glyph"
  }, "\u2205"), /*#__PURE__*/React.createElement("span", {
    className: "cg-brand-name"
  }, "mazze ", /*#__PURE__*/React.createElement("b", null, "leczzare"))), /*#__PURE__*/React.createElement("nav", {
    className: "cg-nav"
  }, navItems.map(item => {
    const isActive = item.id === "landing" && (activeScreen === "landing" || activeScreen === "post");
    return /*#__PURE__*/React.createElement("a", {
      key: item.id,
      href: item.href,
      className: isActive ? "is-active" : "",
      onClick: e => {
        e.preventDefault();
        if (item.id === "landing") onNav?.("landing");
      }
    }, item.label);
  })), /*#__PURE__*/React.createElement("button", {
    className: "cg-theme-toggle",
    onClick: onToggleTheme,
    "aria-label": `Switch to ${theme === "dark" ? "light" : "dark"} mode`
  }, theme === "dark" ? "Light" : "Dark"));
}
window.MetaStrip = MetaStrip;
window.SiteHeader = SiteHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/blog/SiteHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/homepage/Header.jsx
try { (() => {
/* global React */

function Header() {
  return /*#__PURE__*/React.createElement("header", {
    className: "hp-header"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hp-corner-tl"
  }, "mazzeleczzare.com"), /*#__PURE__*/React.createElement("span", {
    className: "hp-corner-tr"
  }, "og image"));
}
function Footer({
  year = 2026
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "hp-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hp-corner-bl"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hp-glyph"
  }, "\u2205"), "\xA0\xA0cipher gothic \xA0\xB7\xA0 v.01 \xA0\xB7\xA0 durham nc"), /*#__PURE__*/React.createElement("span", {
    className: "hp-corner-br"
  }, "35.9940\xB0 N \xA0\xA078.8986\xB0 W"));
}
window.HomepageHeader = Header;
window.HomepageFooter = Footer;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/homepage/Header.jsx", error: String((e && e.message) || e) }); }

// ui_kits/homepage/Hero.jsx
try { (() => {
/* global React, RadarInstrument */

function HomepageHero() {
  return /*#__PURE__*/React.createElement("section", {
    className: "hp-hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hp-left"
  }, /*#__PURE__*/React.createElement(RadarInstrument, {
    size: 460
  })), /*#__PURE__*/React.createElement("div", {
    className: "hp-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hp-eyebrow-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hp-eyebrow"
  }, "cipher gothic"), /*#__PURE__*/React.createElement("span", {
    className: "hp-eyebrow-sep"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hp-eyebrow"
  }, "personal site")), /*#__PURE__*/React.createElement("div", {
    className: "hp-rule hp-rule-top",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("h1", {
    className: "hp-wordmark"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hp-word hp-word-1"
  }, "mazze"), /*#__PURE__*/React.createElement("span", {
    className: "hp-word hp-word-2"
  }, "leczzare")), /*#__PURE__*/React.createElement("div", {
    className: "hp-rule hp-rule-bottom",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("p", {
    className: "hp-tagline"
  }, "writing at the edge of systems"), /*#__PURE__*/React.createElement("a", {
    href: "https://mazzeleczzare.com",
    className: "hp-url"
  }, "mazzeleczzare.com"), /*#__PURE__*/React.createElement("ul", {
    className: "hp-disciplines",
    "aria-label": "Disciplines"
  }, /*#__PURE__*/React.createElement("li", null, "content"), /*#__PURE__*/React.createElement("li", {
    "aria-hidden": "true"
  }, "\xB7"), /*#__PURE__*/React.createElement("li", null, "code"), /*#__PURE__*/React.createElement("li", {
    "aria-hidden": "true"
  }, "\xB7"), /*#__PURE__*/React.createElement("li", null, "craft"))));
}
window.HomepageHero = HomepageHero;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/homepage/Hero.jsx", error: String((e && e.message) || e) }); }

// ui_kits/homepage/HomepageApp.jsx
try { (() => {
/* global React, HomepageHeader, HomepageFooter, HomepageHero */
const {
  useState
} = React;
function HomepageApp() {
  return /*#__PURE__*/React.createElement("div", {
    className: "hp-page"
  }, /*#__PURE__*/React.createElement(HomepageHeader, null), /*#__PURE__*/React.createElement(HomepageHero, null), /*#__PURE__*/React.createElement("span", {
    className: "hp-divider",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hp-divider-cap top",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "hp-divider-cap bot",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement(HomepageFooter, null));
}
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(/*#__PURE__*/React.createElement(HomepageApp, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/homepage/HomepageApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/homepage/RadarInstrument.jsx
try { (() => {
/* global React */

function RadarInstrument({
  size = 480
}) {
  // teal radar mark — concentric arcs with cardinal ticks + single coral signal
  const c = size / 2;
  const tick = (angle, len = 8, r = c - 20) => {
    const a = (angle - 90) * Math.PI / 180;
    const x1 = c + r * Math.cos(a);
    const y1 = c + r * Math.sin(a);
    const x2 = c + (r + len) * Math.cos(a);
    const y2 = c + (r + len) * Math.sin(a);
    return {
      x1,
      y1,
      x2,
      y2
    };
  };
  return /*#__PURE__*/React.createElement("svg", {
    className: "cg-radar",
    viewBox: `0 0 ${size} ${size}`,
    width: size,
    height: size,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("filter", {
    id: "cg-glow",
    x: "-50%",
    y: "-50%",
    width: "200%",
    height: "200%"
  }, /*#__PURE__*/React.createElement("feGaussianBlur", {
    stdDeviation: "2",
    result: "b"
  }), /*#__PURE__*/React.createElement("feMerge", null, /*#__PURE__*/React.createElement("feMergeNode", {
    in: "b"
  }), /*#__PURE__*/React.createElement("feMergeNode", {
    in: "SourceGraphic"
  })))), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c - 14,
    fill: "none",
    stroke: "var(--cg-teal-faint)",
    strokeWidth: "1",
    opacity: "0.55"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c * 0.78,
    fill: "none",
    stroke: "var(--cg-teal-dim)",
    strokeWidth: "0.9",
    opacity: "0.85"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c * 0.58,
    fill: "none",
    stroke: "var(--cg-teal-dim)",
    strokeWidth: "0.8",
    opacity: "0.6",
    strokeDasharray: "120 40 60 28"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c * 0.35,
    fill: "none",
    stroke: "var(--cg-teal)",
    strokeWidth: "1",
    opacity: "0.85",
    strokeDasharray: "50 200",
    strokeDashoffset: "-30"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c * 0.18,
    fill: "none",
    stroke: "var(--cg-teal)",
    strokeWidth: "1.2",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: c * 0.08,
    fill: "none",
    stroke: "var(--cg-teal-dim)",
    strokeWidth: "0.9"
  }), [0, 90, 180, 270].map(a => {
    const t = tick(a, 12, c - 18);
    return /*#__PURE__*/React.createElement("line", {
      key: a,
      x1: t.x1,
      y1: t.y1,
      x2: t.x2,
      y2: t.y2,
      stroke: "var(--cg-teal)",
      strokeWidth: "1.2"
    });
  }), Array.from({
    length: 36
  }).map((_, i) => {
    const a = i * 10;
    if (a % 90 === 0) return null;
    const t = tick(a, 4, c * 0.78);
    return /*#__PURE__*/React.createElement("line", {
      key: `m${i}`,
      x1: t.x1,
      y1: t.y1,
      x2: t.x2,
      y2: t.y2,
      stroke: "var(--cg-teal-dim)",
      strokeWidth: "0.6",
      opacity: "0.7"
    });
  }), /*#__PURE__*/React.createElement("line", {
    x1: c - 12,
    y1: c,
    x2: c + 12,
    y2: c,
    stroke: "var(--cg-teal)",
    strokeWidth: "0.9"
  }), /*#__PURE__*/React.createElement("line", {
    x1: c,
    y1: c - 12,
    x2: c,
    y2: c + 12,
    stroke: "var(--cg-teal)",
    strokeWidth: "0.9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: c,
    cy: c,
    r: 3,
    fill: "var(--cg-coral)",
    filter: "url(#cg-glow)"
  }), [55, 125, 235, 305].map(a => {
    const r = c * 0.58;
    const rad = (a - 90) * Math.PI / 180;
    return /*#__PURE__*/React.createElement("circle", {
      key: a,
      cx: c + r * Math.cos(rad),
      cy: c + r * Math.sin(rad),
      r: "1.6",
      fill: "var(--cg-teal)"
    });
  }), /*#__PURE__*/React.createElement("text", {
    x: c,
    y: 26,
    className: "cg-radar-coord",
    textAnchor: "middle"
  }, "270"), /*#__PURE__*/React.createElement("text", {
    x: c,
    y: size - 14,
    className: "cg-radar-coord",
    textAnchor: "middle"
  }, "090"), /*#__PURE__*/React.createElement("text", {
    x: 20,
    y: c + 4,
    className: "cg-radar-coord",
    textAnchor: "start"
  }, "180"), /*#__PURE__*/React.createElement("text", {
    x: size - 20,
    y: c + 4,
    className: "cg-radar-coord",
    textAnchor: "end"
  }, "000"));
}
window.RadarInstrument = RadarInstrument;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/homepage/RadarInstrument.jsx", error: String((e && e.message) || e) }); }

})();
