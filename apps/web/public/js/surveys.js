function _mergeNamespaces(n2, m2) {
  for (var i2 = 0; i2 < m2.length; i2++) {
    const e2 = m2[i2];
    if (typeof e2 !== "string" && !Array.isArray(e2)) {
      for (const k2 in e2) {
        if (k2 !== "default" && !(k2 in n2)) {
          const d2 = Object.getOwnPropertyDescriptor(e2, k2);
          if (d2) {
            Object.defineProperty(n2, k2, d2.get ? d2 : {
              enumerable: true,
              get: () => e2[k2]
            });
          }
        }
      }
    }
  }
  return Object.freeze(Object.defineProperty(n2, Symbol.toStringTag, { value: "Module" }));
}
var n, l$2, u$2, i$1, o$1, r$3, f$2, e$1, c$1, s$1, h$1 = {}, v$1 = [], p$1 = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, y$1 = Array.isArray;
function d$1(n2, l2) {
  for (var u2 in l2) n2[u2] = l2[u2];
  return n2;
}
function w$2(n2) {
  n2 && n2.parentNode && n2.parentNode.removeChild(n2);
}
function _$1(l2, u2, t2) {
  var i2, o2, r2, f2 = {};
  for (r2 in u2) "key" == r2 ? i2 = u2[r2] : "ref" == r2 ? o2 = u2[r2] : f2[r2] = u2[r2];
  if (arguments.length > 2 && (f2.children = arguments.length > 3 ? n.call(arguments, 2) : t2), "function" == typeof l2 && null != l2.defaultProps) for (r2 in l2.defaultProps) void 0 === f2[r2] && (f2[r2] = l2.defaultProps[r2]);
  return g$1(l2, f2, i2, o2, null);
}
function g$1(n2, t2, i2, o2, r2) {
  var f2 = { type: n2, props: t2, key: i2, ref: o2, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, constructor: void 0, __v: null == r2 ? ++u$2 : r2, __i: -1, __u: 0 };
  return null == r2 && null != l$2.vnode && l$2.vnode(f2), f2;
}
function b(n2) {
  return n2.children;
}
function k$2(n2, l2) {
  this.props = n2, this.context = l2;
}
function x(n2, l2) {
  if (null == l2) return n2.__ ? x(n2.__, n2.__i + 1) : null;
  for (var u2; l2 < n2.__k.length; l2++) if (null != (u2 = n2.__k[l2]) && null != u2.__e) return u2.__e;
  return "function" == typeof n2.type ? x(n2) : null;
}
function C$2(n2) {
  var l2, u2;
  if (null != (n2 = n2.__) && null != n2.__c) {
    for (n2.__e = n2.__c.base = null, l2 = 0; l2 < n2.__k.length; l2++) if (null != (u2 = n2.__k[l2]) && null != u2.__e) {
      n2.__e = n2.__c.base = u2.__e;
      break;
    }
    return C$2(n2);
  }
}
function M$1(n2) {
  (!n2.__d && (n2.__d = true) && i$1.push(n2) && !P$1.__r++ || o$1 !== l$2.debounceRendering) && ((o$1 = l$2.debounceRendering) || r$3)(P$1);
}
function P$1() {
  var n2, u2, t2, o2, r2, e2, c2, s2;
  for (i$1.sort(f$2); n2 = i$1.shift(); ) n2.__d && (u2 = i$1.length, o2 = void 0, e2 = (r2 = (t2 = n2).__v).__e, c2 = [], s2 = [], t2.__P && ((o2 = d$1({}, r2)).__v = r2.__v + 1, l$2.vnode && l$2.vnode(o2), O$1(t2.__P, o2, r2, t2.__n, t2.__P.namespaceURI, 32 & r2.__u ? [e2] : null, c2, null == e2 ? x(r2) : e2, !!(32 & r2.__u), s2), o2.__v = r2.__v, o2.__.__k[o2.__i] = o2, j$2(c2, o2, s2), o2.__e != e2 && C$2(o2)), i$1.length > u2 && i$1.sort(f$2));
  P$1.__r = 0;
}
function S(n2, l2, u2, t2, i2, o2, r2, f2, e2, c2, s2) {
  var a2, p2, y2, d2, w2, _2 = t2 && t2.__k || v$1, g2 = l2.length;
  for (u2.__d = e2, $$1(u2, l2, _2), e2 = u2.__d, a2 = 0; a2 < g2; a2++) null != (y2 = u2.__k[a2]) && (p2 = -1 === y2.__i ? h$1 : _2[y2.__i] || h$1, y2.__i = a2, O$1(n2, y2, p2, i2, o2, r2, f2, e2, c2, s2), d2 = y2.__e, y2.ref && p2.ref != y2.ref && (p2.ref && N$1(p2.ref, null, y2), s2.push(y2.ref, y2.__c || d2, y2)), null == w2 && null != d2 && (w2 = d2), 65536 & y2.__u || p2.__k === y2.__k ? e2 = I$1(y2, e2, n2) : "function" == typeof y2.type && void 0 !== y2.__d ? e2 = y2.__d : d2 && (e2 = d2.nextSibling), y2.__d = void 0, y2.__u &= -196609);
  u2.__d = e2, u2.__e = w2;
}
function $$1(n2, l2, u2) {
  var t2, i2, o2, r2, f2, e2 = l2.length, c2 = u2.length, s2 = c2, a2 = 0;
  for (n2.__k = [], t2 = 0; t2 < e2; t2++) null != (i2 = l2[t2]) && "boolean" != typeof i2 && "function" != typeof i2 ? (r2 = t2 + a2, (i2 = n2.__k[t2] = "string" == typeof i2 || "number" == typeof i2 || "bigint" == typeof i2 || i2.constructor == String ? g$1(null, i2, null, null, null) : y$1(i2) ? g$1(b, { children: i2 }, null, null, null) : void 0 === i2.constructor && i2.__b > 0 ? g$1(i2.type, i2.props, i2.key, i2.ref ? i2.ref : null, i2.__v) : i2).__ = n2, i2.__b = n2.__b + 1, o2 = null, -1 !== (f2 = i2.__i = L$1(i2, u2, r2, s2)) && (s2--, (o2 = u2[f2]) && (o2.__u |= 131072)), null == o2 || null === o2.__v ? (-1 == f2 && a2--, "function" != typeof i2.type && (i2.__u |= 65536)) : f2 !== r2 && (f2 == r2 - 1 ? a2-- : f2 == r2 + 1 ? a2++ : (f2 > r2 ? a2-- : a2++, i2.__u |= 65536))) : i2 = n2.__k[t2] = null;
  if (s2) for (t2 = 0; t2 < c2; t2++) null != (o2 = u2[t2]) && 0 == (131072 & o2.__u) && (o2.__e == n2.__d && (n2.__d = x(o2)), V$1(o2, o2));
}
function I$1(n2, l2, u2) {
  var t2, i2;
  if ("function" == typeof n2.type) {
    for (t2 = n2.__k, i2 = 0; t2 && i2 < t2.length; i2++) t2[i2] && (t2[i2].__ = n2, l2 = I$1(t2[i2], l2, u2));
    return l2;
  }
  n2.__e != l2 && (l2 && n2.type && !u2.contains(l2) && (l2 = x(n2)), u2.insertBefore(n2.__e, l2 || null), l2 = n2.__e);
  do {
    l2 = l2 && l2.nextSibling;
  } while (null != l2 && 8 === l2.nodeType);
  return l2;
}
function H$1(n2, l2) {
  return l2 = l2 || [], null == n2 || "boolean" == typeof n2 || (y$1(n2) ? n2.some(function(n3) {
    H$1(n3, l2);
  }) : l2.push(n2)), l2;
}
function L$1(n2, l2, u2, t2) {
  var i2 = n2.key, o2 = n2.type, r2 = u2 - 1, f2 = u2 + 1, e2 = l2[u2];
  if (null === e2 || e2 && i2 == e2.key && o2 === e2.type && 0 == (131072 & e2.__u)) return u2;
  if (t2 > (null != e2 && 0 == (131072 & e2.__u) ? 1 : 0)) for (; r2 >= 0 || f2 < l2.length; ) {
    if (r2 >= 0) {
      if ((e2 = l2[r2]) && 0 == (131072 & e2.__u) && i2 == e2.key && o2 === e2.type) return r2;
      r2--;
    }
    if (f2 < l2.length) {
      if ((e2 = l2[f2]) && 0 == (131072 & e2.__u) && i2 == e2.key && o2 === e2.type) return f2;
      f2++;
    }
  }
  return -1;
}
function T$2(n2, l2, u2) {
  "-" === l2[0] ? n2.setProperty(l2, null == u2 ? "" : u2) : n2[l2] = null == u2 ? "" : "number" != typeof u2 || p$1.test(l2) ? u2 : u2 + "px";
}
function A$2(n2, l2, u2, t2, i2) {
  var o2;
  n: if ("style" === l2) if ("string" == typeof u2) n2.style.cssText = u2;
  else {
    if ("string" == typeof t2 && (n2.style.cssText = t2 = ""), t2) for (l2 in t2) u2 && l2 in u2 || T$2(n2.style, l2, "");
    if (u2) for (l2 in u2) t2 && u2[l2] === t2[l2] || T$2(n2.style, l2, u2[l2]);
  }
  else if ("o" === l2[0] && "n" === l2[1]) o2 = l2 !== (l2 = l2.replace(/(PointerCapture)$|Capture$/i, "$1")), l2 = l2.toLowerCase() in n2 || "onFocusOut" === l2 || "onFocusIn" === l2 ? l2.toLowerCase().slice(2) : l2.slice(2), n2.l || (n2.l = {}), n2.l[l2 + o2] = u2, u2 ? t2 ? u2.u = t2.u : (u2.u = e$1, n2.addEventListener(l2, o2 ? s$1 : c$1, o2)) : n2.removeEventListener(l2, o2 ? s$1 : c$1, o2);
  else {
    if ("http://www.w3.org/2000/svg" == i2) l2 = l2.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
    else if ("width" != l2 && "height" != l2 && "href" != l2 && "list" != l2 && "form" != l2 && "tabIndex" != l2 && "download" != l2 && "rowSpan" != l2 && "colSpan" != l2 && "role" != l2 && "popover" != l2 && l2 in n2) try {
      n2[l2] = null == u2 ? "" : u2;
      break n;
    } catch (n3) {
    }
    "function" == typeof u2 || (null == u2 || false === u2 && "-" !== l2[4] ? n2.removeAttribute(l2) : n2.setAttribute(l2, "popover" == l2 && 1 == u2 ? "" : u2));
  }
}
function F$1(n2) {
  return function(u2) {
    if (this.l) {
      var t2 = this.l[u2.type + n2];
      if (null == u2.t) u2.t = e$1++;
      else if (u2.t < t2.u) return;
      return t2(l$2.event ? l$2.event(u2) : u2);
    }
  };
}
function O$1(n2, u2, t2, i2, o2, r2, f2, e2, c2, s2) {
  var a2, h2, v2, p2, w2, _2, g2, m2, x2, C2, M2, P2, $2, I2, H2, L2, T2 = u2.type;
  if (void 0 !== u2.constructor) return null;
  128 & t2.__u && (c2 = !!(32 & t2.__u), r2 = [e2 = u2.__e = t2.__e]), (a2 = l$2.__b) && a2(u2);
  n: if ("function" == typeof T2) try {
    if (m2 = u2.props, x2 = "prototype" in T2 && T2.prototype.render, C2 = (a2 = T2.contextType) && i2[a2.__c], M2 = a2 ? C2 ? C2.props.value : a2.__ : i2, t2.__c ? g2 = (h2 = u2.__c = t2.__c).__ = h2.__E : (x2 ? u2.__c = h2 = new T2(m2, M2) : (u2.__c = h2 = new k$2(m2, M2), h2.constructor = T2, h2.render = q$1), C2 && C2.sub(h2), h2.props = m2, h2.state || (h2.state = {}), h2.context = M2, h2.__n = i2, v2 = h2.__d = true, h2.__h = [], h2._sb = []), x2 && null == h2.__s && (h2.__s = h2.state), x2 && null != T2.getDerivedStateFromProps && (h2.__s == h2.state && (h2.__s = d$1({}, h2.__s)), d$1(h2.__s, T2.getDerivedStateFromProps(m2, h2.__s))), p2 = h2.props, w2 = h2.state, h2.__v = u2, v2) x2 && null == T2.getDerivedStateFromProps && null != h2.componentWillMount && h2.componentWillMount(), x2 && null != h2.componentDidMount && h2.__h.push(h2.componentDidMount);
    else {
      if (x2 && null == T2.getDerivedStateFromProps && m2 !== p2 && null != h2.componentWillReceiveProps && h2.componentWillReceiveProps(m2, M2), !h2.__e && (null != h2.shouldComponentUpdate && false === h2.shouldComponentUpdate(m2, h2.__s, M2) || u2.__v === t2.__v)) {
        for (u2.__v !== t2.__v && (h2.props = m2, h2.state = h2.__s, h2.__d = false), u2.__e = t2.__e, u2.__k = t2.__k, u2.__k.some(function(n3) {
          n3 && (n3.__ = u2);
        }), P2 = 0; P2 < h2._sb.length; P2++) h2.__h.push(h2._sb[P2]);
        h2._sb = [], h2.__h.length && f2.push(h2);
        break n;
      }
      null != h2.componentWillUpdate && h2.componentWillUpdate(m2, h2.__s, M2), x2 && null != h2.componentDidUpdate && h2.__h.push(function() {
        h2.componentDidUpdate(p2, w2, _2);
      });
    }
    if (h2.context = M2, h2.props = m2, h2.__P = n2, h2.__e = false, $2 = l$2.__r, I2 = 0, x2) {
      for (h2.state = h2.__s, h2.__d = false, $2 && $2(u2), a2 = h2.render(h2.props, h2.state, h2.context), H2 = 0; H2 < h2._sb.length; H2++) h2.__h.push(h2._sb[H2]);
      h2._sb = [];
    } else do {
      h2.__d = false, $2 && $2(u2), a2 = h2.render(h2.props, h2.state, h2.context), h2.state = h2.__s;
    } while (h2.__d && ++I2 < 25);
    h2.state = h2.__s, null != h2.getChildContext && (i2 = d$1(d$1({}, i2), h2.getChildContext())), x2 && !v2 && null != h2.getSnapshotBeforeUpdate && (_2 = h2.getSnapshotBeforeUpdate(p2, w2)), S(n2, y$1(L2 = null != a2 && a2.type === b && null == a2.key ? a2.props.children : a2) ? L2 : [L2], u2, t2, i2, o2, r2, f2, e2, c2, s2), h2.base = u2.__e, u2.__u &= -161, h2.__h.length && f2.push(h2), g2 && (h2.__E = h2.__ = null);
  } catch (n3) {
    if (u2.__v = null, c2 || null != r2) {
      for (u2.__u |= c2 ? 160 : 32; e2 && 8 === e2.nodeType && e2.nextSibling; ) e2 = e2.nextSibling;
      r2[r2.indexOf(e2)] = null, u2.__e = e2;
    } else u2.__e = t2.__e, u2.__k = t2.__k;
    l$2.__e(n3, u2, t2);
  }
  else null == r2 && u2.__v === t2.__v ? (u2.__k = t2.__k, u2.__e = t2.__e) : u2.__e = z$3(t2.__e, u2, t2, i2, o2, r2, f2, c2, s2);
  (a2 = l$2.diffed) && a2(u2);
}
function j$2(n2, u2, t2) {
  u2.__d = void 0;
  for (var i2 = 0; i2 < t2.length; i2++) N$1(t2[i2], t2[++i2], t2[++i2]);
  l$2.__c && l$2.__c(u2, n2), n2.some(function(u3) {
    try {
      n2 = u3.__h, u3.__h = [], n2.some(function(n3) {
        n3.call(u3);
      });
    } catch (n3) {
      l$2.__e(n3, u3.__v);
    }
  });
}
function z$3(u2, t2, i2, o2, r2, f2, e2, c2, s2) {
  var a2, v2, p2, d2, _2, g2, m2, b2 = i2.props, k2 = t2.props, C2 = t2.type;
  if ("svg" === C2 ? r2 = "http://www.w3.org/2000/svg" : "math" === C2 ? r2 = "http://www.w3.org/1998/Math/MathML" : r2 || (r2 = "http://www.w3.org/1999/xhtml"), null != f2) {
    for (a2 = 0; a2 < f2.length; a2++) if ((_2 = f2[a2]) && "setAttribute" in _2 == !!C2 && (C2 ? _2.localName === C2 : 3 === _2.nodeType)) {
      u2 = _2, f2[a2] = null;
      break;
    }
  }
  if (null == u2) {
    if (null === C2) return document.createTextNode(k2);
    u2 = document.createElementNS(r2, C2, k2.is && k2), c2 && (l$2.__m && l$2.__m(t2, f2), c2 = false), f2 = null;
  }
  if (null === C2) b2 === k2 || c2 && u2.data === k2 || (u2.data = k2);
  else {
    if (f2 = f2 && n.call(u2.childNodes), b2 = i2.props || h$1, !c2 && null != f2) for (b2 = {}, a2 = 0; a2 < u2.attributes.length; a2++) b2[(_2 = u2.attributes[a2]).name] = _2.value;
    for (a2 in b2) if (_2 = b2[a2], "children" == a2) ;
    else if ("dangerouslySetInnerHTML" == a2) p2 = _2;
    else if (!(a2 in k2)) {
      if ("value" == a2 && "defaultValue" in k2 || "checked" == a2 && "defaultChecked" in k2) continue;
      A$2(u2, a2, null, _2, r2);
    }
    for (a2 in k2) _2 = k2[a2], "children" == a2 ? d2 = _2 : "dangerouslySetInnerHTML" == a2 ? v2 = _2 : "value" == a2 ? g2 = _2 : "checked" == a2 ? m2 = _2 : c2 && "function" != typeof _2 || b2[a2] === _2 || A$2(u2, a2, _2, b2[a2], r2);
    if (v2) c2 || p2 && (v2.__html === p2.__html || v2.__html === u2.innerHTML) || (u2.innerHTML = v2.__html), t2.__k = [];
    else if (p2 && (u2.innerHTML = ""), S(u2, y$1(d2) ? d2 : [d2], t2, i2, o2, "foreignObject" === C2 ? "http://www.w3.org/1999/xhtml" : r2, f2, e2, f2 ? f2[0] : i2.__k && x(i2, 0), c2, s2), null != f2) for (a2 = f2.length; a2--; ) w$2(f2[a2]);
    c2 || (a2 = "value", "progress" === C2 && null == g2 ? u2.removeAttribute("value") : void 0 !== g2 && (g2 !== u2[a2] || "progress" === C2 && !g2 || "option" === C2 && g2 !== b2[a2]) && A$2(u2, a2, g2, b2[a2], r2), a2 = "checked", void 0 !== m2 && m2 !== u2[a2] && A$2(u2, a2, m2, b2[a2], r2));
  }
  return u2;
}
function N$1(n2, u2, t2) {
  try {
    if ("function" == typeof n2) {
      var i2 = "function" == typeof n2.__u;
      i2 && n2.__u(), i2 && null == u2 || (n2.__u = n2(u2));
    } else n2.current = u2;
  } catch (n3) {
    l$2.__e(n3, t2);
  }
}
function V$1(n2, u2, t2) {
  var i2, o2;
  if (l$2.unmount && l$2.unmount(n2), (i2 = n2.ref) && (i2.current && i2.current !== n2.__e || N$1(i2, null, u2)), null != (i2 = n2.__c)) {
    if (i2.componentWillUnmount) try {
      i2.componentWillUnmount();
    } catch (n3) {
      l$2.__e(n3, u2);
    }
    i2.base = i2.__P = null;
  }
  if (i2 = n2.__k) for (o2 = 0; o2 < i2.length; o2++) i2[o2] && V$1(i2[o2], u2, t2 || "function" != typeof n2.type);
  t2 || w$2(n2.__e), n2.__c = n2.__ = n2.__e = n2.__d = void 0;
}
function q$1(n2, l2, u2) {
  return this.constructor(n2, u2);
}
function B$2(u2, t2, i2) {
  var o2, r2, f2, e2;
  l$2.__ && l$2.__(u2, t2), r2 = (o2 = "function" == typeof i2) ? null : t2.__k, f2 = [], e2 = [], O$1(t2, u2 = (!o2 && i2 || t2).__k = _$1(b, null, [u2]), r2 || h$1, h$1, t2.namespaceURI, !o2 && i2 ? [i2] : r2 ? null : t2.firstChild ? n.call(t2.childNodes) : null, f2, !o2 && i2 ? i2 : r2 ? r2.__e : t2.firstChild, o2, e2), j$2(f2, u2, e2);
}
function E$1(l2, u2, t2) {
  var i2, o2, r2, f2, e2 = d$1({}, l2.props);
  for (r2 in l2.type && l2.type.defaultProps && (f2 = l2.type.defaultProps), u2) "key" == r2 ? i2 = u2[r2] : "ref" == r2 ? o2 = u2[r2] : e2[r2] = void 0 === u2[r2] && void 0 !== f2 ? f2[r2] : u2[r2];
  return arguments.length > 2 && (e2.children = arguments.length > 3 ? n.call(arguments, 2) : t2), g$1(l2.type, e2, i2 || l2.key, o2 || l2.ref, null);
}
n = v$1.slice, l$2 = { __e: function(n2, l2, u2, t2) {
  for (var i2, o2, r2; l2 = l2.__; ) if ((i2 = l2.__c) && !i2.__) try {
    if ((o2 = i2.constructor) && null != o2.getDerivedStateFromError && (i2.setState(o2.getDerivedStateFromError(n2)), r2 = i2.__d), null != i2.componentDidCatch && (i2.componentDidCatch(n2, t2 || {}), r2 = i2.__d), r2) return i2.__E = i2;
  } catch (l3) {
    n2 = l3;
  }
  throw n2;
} }, u$2 = 0, k$2.prototype.setState = function(n2, l2) {
  var u2;
  u2 = null != this.__s && this.__s !== this.state ? this.__s : this.__s = d$1({}, this.state), "function" == typeof n2 && (n2 = n2(d$1({}, u2), this.props)), n2 && d$1(u2, n2), null != n2 && this.__v && (l2 && this._sb.push(l2), M$1(this));
}, k$2.prototype.forceUpdate = function(n2) {
  this.__v && (this.__e = true, n2 && this.__h.push(n2), M$1(this));
}, k$2.prototype.render = b, i$1 = [], r$3 = "function" == typeof Promise ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, f$2 = function(n2, l2) {
  return n2.__v.__b - l2.__v.__b;
}, P$1.__r = 0, e$1 = 0, c$1 = F$1(false), s$1 = F$1(true);
var f$1 = 0;
function u$1(e2, t2, n2, o2, i2, u2) {
  t2 || (t2 = {});
  var a2, c2, p2 = t2;
  if ("ref" in p2) for (c2 in p2 = {}, t2) "ref" == c2 ? a2 = t2[c2] : p2[c2] = t2[c2];
  var l2 = { type: e2, props: p2, key: n2, ref: a2, __k: null, __: null, __b: 0, __e: null, __d: void 0, __c: null, constructor: void 0, __v: --f$1, __i: -1, __u: 0, __source: i2, __self: u2 };
  if ("function" == typeof e2 && (a2 = e2.defaultProps)) for (c2 in a2) void 0 === p2[c2] && (p2[c2] = a2[c2]);
  return l$2.vnode && l$2.vnode(l2), l2;
}
var t, r$2, u, i, o = 0, f = [], c = l$2, e = c.__b, a = c.__r, v = c.diffed, l$1 = c.__c, m = c.unmount, s = c.__;
function d(n2, t2) {
  c.__h && c.__h(r$2, n2, o || t2), o = 0;
  var u2 = r$2.__H || (r$2.__H = { __: [], __h: [] });
  return n2 >= u2.__.length && u2.__.push({}), u2.__[n2];
}
function h(n2) {
  return o = 1, p(D$1, n2);
}
function p(n2, u2, i2) {
  var o2 = d(t++, 2);
  if (o2.t = n2, !o2.__c && (o2.__ = [i2 ? i2(u2) : D$1(void 0, u2), function(n3) {
    var t2 = o2.__N ? o2.__N[0] : o2.__[0], r2 = o2.t(t2, n3);
    t2 !== r2 && (o2.__N = [r2, o2.__[1]], o2.__c.setState({}));
  }], o2.__c = r$2, !r$2.u)) {
    var f2 = function(n3, t2, r2) {
      if (!o2.__c.__H) return true;
      var u3 = o2.__c.__H.__.filter(function(n4) {
        return !!n4.__c;
      });
      if (u3.every(function(n4) {
        return !n4.__N;
      })) return !c2 || c2.call(this, n3, t2, r2);
      var i3 = false;
      return u3.forEach(function(n4) {
        if (n4.__N) {
          var t3 = n4.__[0];
          n4.__ = n4.__N, n4.__N = void 0, t3 !== n4.__[0] && (i3 = true);
        }
      }), !(!i3 && o2.__c.props === n3) && (!c2 || c2.call(this, n3, t2, r2));
    };
    r$2.u = true;
    var c2 = r$2.shouldComponentUpdate, e2 = r$2.componentWillUpdate;
    r$2.componentWillUpdate = function(n3, t2, r2) {
      if (this.__e) {
        var u3 = c2;
        c2 = void 0, f2(n3, t2, r2), c2 = u3;
      }
      e2 && e2.call(this, n3, t2, r2);
    }, r$2.shouldComponentUpdate = f2;
  }
  return o2.__N || o2.__;
}
function y(n2, u2) {
  var i2 = d(t++, 3);
  !c.__s && C$1(i2.__H, u2) && (i2.__ = n2, i2.i = u2, r$2.__H.__h.push(i2));
}
function _(n2, u2) {
  var i2 = d(t++, 4);
  !c.__s && C$1(i2.__H, u2) && (i2.__ = n2, i2.i = u2, r$2.__h.push(i2));
}
function A$1(n2) {
  return o = 5, T$1(function() {
    return { current: n2 };
  }, []);
}
function F(n2, t2, r2) {
  o = 6, _(function() {
    return "function" == typeof n2 ? (n2(t2()), function() {
      return n2(null);
    }) : n2 ? (n2.current = t2(), function() {
      return n2.current = null;
    }) : void 0;
  }, null == r2 ? r2 : r2.concat(n2));
}
function T$1(n2, r2) {
  var u2 = d(t++, 7);
  return C$1(u2.__H, r2) && (u2.__ = n2(), u2.__H = r2, u2.__h = n2), u2.__;
}
function q(n2, t2) {
  return o = 8, T$1(function() {
    return n2;
  }, t2);
}
function j$1() {
  for (var n2; n2 = f.shift(); ) if (n2.__P && n2.__H) try {
    n2.__H.__h.forEach(z$2), n2.__H.__h.forEach(B$1), n2.__H.__h = [];
  } catch (t2) {
    n2.__H.__h = [], c.__e(t2, n2.__v);
  }
}
c.__b = function(n2) {
  r$2 = null, e && e(n2);
}, c.__ = function(n2, t2) {
  n2 && t2.__k && t2.__k.__m && (n2.__m = t2.__k.__m), s && s(n2, t2);
}, c.__r = function(n2) {
  a && a(n2), t = 0;
  var i2 = (r$2 = n2.__c).__H;
  i2 && (u === r$2 ? (i2.__h = [], r$2.__h = [], i2.__.forEach(function(n3) {
    n3.__N && (n3.__ = n3.__N), n3.i = n3.__N = void 0;
  })) : (i2.__h.forEach(z$2), i2.__h.forEach(B$1), i2.__h = [], t = 0)), u = r$2;
}, c.diffed = function(n2) {
  v && v(n2);
  var t2 = n2.__c;
  t2 && t2.__H && (t2.__H.__h.length && (1 !== f.push(t2) && i === c.requestAnimationFrame || ((i = c.requestAnimationFrame) || w$1)(j$1)), t2.__H.__.forEach(function(n3) {
    n3.i && (n3.__H = n3.i), n3.i = void 0;
  })), u = r$2 = null;
}, c.__c = function(n2, t2) {
  t2.some(function(n3) {
    try {
      n3.__h.forEach(z$2), n3.__h = n3.__h.filter(function(n4) {
        return !n4.__ || B$1(n4);
      });
    } catch (r2) {
      t2.some(function(n4) {
        n4.__h && (n4.__h = []);
      }), t2 = [], c.__e(r2, n3.__v);
    }
  }), l$1 && l$1(n2, t2);
}, c.unmount = function(n2) {
  m && m(n2);
  var t2, r2 = n2.__c;
  r2 && r2.__H && (r2.__H.__.forEach(function(n3) {
    try {
      z$2(n3);
    } catch (n4) {
      t2 = n4;
    }
  }), r2.__H = void 0, t2 && c.__e(t2, r2.__v));
};
var k$1 = "function" == typeof requestAnimationFrame;
function w$1(n2) {
  var t2, r2 = function() {
    clearTimeout(u2), k$1 && cancelAnimationFrame(t2), setTimeout(n2);
  }, u2 = setTimeout(r2, 100);
  k$1 && (t2 = requestAnimationFrame(r2));
}
function z$2(n2) {
  var t2 = r$2, u2 = n2.__c;
  "function" == typeof u2 && (n2.__c = void 0, u2()), r$2 = t2;
}
function B$1(n2) {
  var t2 = r$2;
  n2.__c = n2.__(), r$2 = t2;
}
function C$1(n2, t2) {
  return !n2 || n2.length !== t2.length || t2.some(function(t3, r2) {
    return t3 !== n2[r2];
  });
}
function D$1(n2, t2) {
  return "function" == typeof t2 ? t2(n2) : t2;
}
const SubmitButton = ({
  buttonLabel,
  isLastQuestion,
  tabIndex = 1,
  focus: focus2 = false,
  onClick,
  disabled,
  type,
  ...props
}) => {
  const buttonRef = q(
    (currentButton) => {
      if (currentButton && focus2) {
        setTimeout(() => {
          currentButton.focus();
        }, 200);
      }
    },
    [focus2]
  );
  return /* @__PURE__ */ u$1(
    "button",
    {
      ...props,
      dir: "auto",
      ref: buttonRef,
      type,
      tabIndex,
      autoFocus: focus2,
      className: "fb-bg-brand fb-border-submit-button-border fb-text-on-brand focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2",
      onClick,
      disabled,
      children: buttonLabel || (isLastQuestion ? "Finish" : "Next")
    }
  );
};
const Headline = ({
  headline,
  questionId,
  required = true,
  alignTextCenter = false
}) => {
  return /* @__PURE__ */ u$1(
    "label",
    {
      htmlFor: questionId,
      className: "fb-text-heading fb-mb-1.5 fb-block fb-text-base fb-font-semibold fb-leading-6",
      children: /* @__PURE__ */ u$1(
        "div",
        {
          className: `fb-flex fb-items-center ${alignTextCenter ? "fb-justify-center" : "fb-justify-between"}`,
          dir: "auto",
          children: [
            headline,
            !required && /* @__PURE__ */ u$1(
              "span",
              {
                className: "fb-text-heading fb-mx-2 fb-self-start fb-text-sm fb-font-normal fb-leading-7 fb-opacity-60",
                tabIndex: -1,
                children: "Optional"
              }
            )
          ]
        }
      )
    }
  );
};
const cn = (...classes) => {
  return classes.filter(Boolean).join(" ");
};
const shuffle = (array) => {
  for (let i2 = 0; i2 < array.length; i2++) {
    const j2 = Math.floor(Math.random() * (i2 + 1));
    [array[i2], array[j2]] = [array[j2], array[i2]];
  }
};
const getShuffledRowIndices = (n2, shuffleOption) => {
  let array = Array.from(Array(n2).keys());
  if (shuffleOption === "all") {
    shuffle(array);
  } else if (shuffleOption === "exceptLast") {
    const lastElement = array.pop();
    if (lastElement) {
      shuffle(array);
      array.push(lastElement);
    }
  }
  return array;
};
const getShuffledChoicesIds = (choices, shuffleOption) => {
  const otherOption = choices.find((choice) => {
    return choice.id === "other";
  });
  const shuffledChoices = otherOption ? [...choices.filter((choice) => choice.id !== "other")] : [...choices];
  if (shuffleOption === "all") {
    shuffle(shuffledChoices);
  } else if (shuffleOption === "exceptLast") {
    if (otherOption) {
      shuffle(shuffledChoices);
    } else {
      const lastElement = shuffledChoices.pop();
      if (lastElement) {
        shuffle(shuffledChoices);
        shuffledChoices.push(lastElement);
      }
    }
  }
  if (otherOption) shuffledChoices.push(otherOption);
  return shuffledChoices.map((choice) => choice.id);
};
const calculateElementIdx = (survey, currentQustionIdx) => {
  const currentQuestion = survey.questions[currentQustionIdx];
  const surveyLength = survey.questions.length;
  const middleIdx = Math.floor(surveyLength / 2);
  const possibleNextQuestions = getPossibleNextQuestions(currentQuestion);
  const getLastQuestionIndex = () => {
    const lastQuestion = survey.questions.filter((q2) => possibleNextQuestions.includes(q2.id)).sort((a2, b2) => survey.questions.indexOf(a2) - survey.questions.indexOf(b2)).pop();
    return survey.questions.findIndex((e2) => e2.id === (lastQuestion == null ? void 0 : lastQuestion.id));
  };
  let elementIdx = currentQustionIdx || 0.5;
  const lastprevQuestionIdx = getLastQuestionIndex();
  if (lastprevQuestionIdx > 0) elementIdx = Math.min(middleIdx, lastprevQuestionIdx - 1);
  if (possibleNextQuestions.includes("end")) elementIdx = middleIdx;
  return elementIdx;
};
const getPossibleNextQuestions = (question) => {
  if (!question.logic) return [];
  const possibleDestinations = [];
  question.logic.forEach((logic) => {
    logic.actions.forEach((action) => {
      if (action.objective === "jumpToQuestion") {
        possibleDestinations.push(action.target);
      }
    });
  });
  return possibleDestinations;
};
const LoadingSpinner = ({ className: className2 }) => {
  return /* @__PURE__ */ u$1(
    "div",
    {
      "data-testid": "loading-spinner",
      className: cn("fb-flex fb-h-full fb-w-full fb-items-center fb-justify-center", className2 ?? ""),
      children: /* @__PURE__ */ u$1(
        "svg",
        {
          className: "fb-m-2 fb-h-6 fb-w-6 fb-animate-spin fb-text-brand",
          xmlns: "http://www.w3.org/2000/svg",
          fill: "none",
          viewBox: "0 0 24 24",
          children: [
            /* @__PURE__ */ u$1(
              "circle",
              {
                className: "fb-opacity-25",
                cx: "12",
                cy: "12",
                r: "10",
                stroke: "currentColor",
                strokeWidth: "4"
              }
            ),
            /* @__PURE__ */ u$1(
              "path",
              {
                className: "fb-opacity-75",
                fill: "currentColor",
                d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              }
            )
          ]
        }
      )
    }
  );
};
const checkForYoutubeUrl = (url) => {
  try {
    const youtubeUrl = new URL(url);
    if (youtubeUrl.protocol !== "https:") return false;
    const youtubeDomains = [
      "www.youtube.com",
      "www.youtu.be",
      "www.youtube-nocookie.com",
      "youtube.com",
      "youtu.be",
      "youtube-nocookie.com"
    ];
    const hostname = youtubeUrl.hostname;
    return youtubeDomains.includes(hostname);
  } catch (err) {
    return false;
  }
};
const checkForVimeoUrl = (url) => {
  try {
    const vimeoUrl = new URL(url);
    if (vimeoUrl.protocol !== "https:") return false;
    const vimeoDomains = ["www.vimeo.com", "vimeo.com"];
    const hostname = vimeoUrl.hostname;
    return vimeoDomains.includes(hostname);
  } catch (err) {
    return false;
  }
};
const checkForLoomUrl = (url) => {
  try {
    const loomUrl = new URL(url);
    if (loomUrl.protocol !== "https:") return false;
    const loomDomains = ["www.loom.com", "loom.com"];
    const hostname = loomUrl.hostname;
    return loomDomains.includes(hostname);
  } catch (err) {
    return false;
  }
};
const extractYoutubeId = (url) => {
  let id = "";
  const regExpList = [
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    // youtu.be/<id>
    /youtube\.com.*v=([a-zA-Z0-9_-]+)/,
    // youtube.com/watch?v=<id>
    /youtube\.com.*embed\/([a-zA-Z0-9_-]+)/,
    // youtube.com/embed/<id>
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]+)/
    // youtube-nocookie.com/embed/<id>
  ];
  regExpList.some((regExp) => {
    const match = url.match(regExp);
    if (match && match[1]) {
      id = match[1];
      return true;
    }
    return false;
  });
  return id;
};
const extractVimeoId = (url) => {
  const regExp = /vimeo\.com\/(\d+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};
const extractLoomId = (url) => {
  const regExp = /loom\.com\/share\/([a-zA-Z0-9]+)/;
  const match = url.match(regExp);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};
const parseVideoUrl = (url) => {
  if (checkForYoutubeUrl(url)) {
    if (url.includes("/embed/")) {
      const videoId = url.split("/embed/")[1].split("?")[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      const videoId = extractYoutubeId(url);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
  } else if (checkForVimeoUrl(url)) {
    if (url.includes("/video/")) {
      const videoId = url.split("/video/")[1].split("?")[0];
      return `https://www.vimeo.com/${videoId}`;
    } else {
      const videoId = extractVimeoId(url);
      return `https://player.vimeo.com/video/${videoId}`;
    }
  } else if (checkForLoomUrl(url)) {
    if (url.includes("/embed/")) {
      const videoId = url.split("/embed/")[1].split("?")[0];
      return `https://www.loom.com/share/${videoId}`;
    } else {
      const videoId = extractLoomId(url);
      return `https://www.loom.com/embed/${videoId}`;
    }
  }
};
const getVideoUrlWithParams = (videoUrl) => {
  const isYoutubeVideo = checkForYoutubeUrl(videoUrl);
  const isVimeoUrl = checkForVimeoUrl(videoUrl);
  const isLoomUrl = checkForLoomUrl(videoUrl);
  if (isYoutubeVideo) return videoUrl.concat("?controls=0");
  else if (isVimeoUrl)
    return videoUrl.concat(
      "?title=false&transcript=false&speed=false&quality_selector=false&progress_bar=false&pip=false&fullscreen=false&cc=false&chromecast=false"
    );
  else if (isLoomUrl) return videoUrl.concat("?hide_share=true&hideEmbedTopBar=true&hide_title=true");
  else return videoUrl;
};
const QuestionMedia = ({ imgUrl, videoUrl, altText = "Image" }) => {
  const videoUrlWithParams = videoUrl ? getVideoUrlWithParams(videoUrl) : void 0;
  const [isLoading, setIsLoading] = h(true);
  return /* @__PURE__ */ u$1("div", { className: "fb-group/image fb-relative fb-mb-4 fb-block fb-min-h-40 fb-rounded-md", children: [
    isLoading && /* @__PURE__ */ u$1("div", { className: "fb-absolute fb-inset-auto fb-flex fb-h-full fb-w-full fb-animate-pulse fb-items-center fb-justify-center fb-rounded-md fb-bg-slate-200" }),
    imgUrl && /* @__PURE__ */ u$1(
      "img",
      {
        src: imgUrl,
        alt: altText,
        className: "fb-rounded-custom",
        onLoad: () => {
          setIsLoading(false);
        }
      },
      imgUrl
    ),
    videoUrlWithParams && /* @__PURE__ */ u$1("div", { className: "fb-relative", children: /* @__PURE__ */ u$1("div", { className: "fb-rounded-custom fb-bg-black", children: /* @__PURE__ */ u$1(
      "iframe",
      {
        src: videoUrlWithParams,
        title: "Question Video",
        frameborder: "0",
        className: "fb-rounded-custom fb-aspect-video fb-w-full",
        onLoad: () => setIsLoading(false),
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share",
        referrerpolicy: "strict-origin-when-cross-origin"
      }
    ) }) }),
    /* @__PURE__ */ u$1(
      "a",
      {
        href: !!imgUrl ? imgUrl : parseVideoUrl(videoUrl ?? ""),
        target: "_blank",
        rel: "noreferrer",
        className: "fb-absolute fb-bottom-2 fb-right-2 fb-flex fb-items-center fb-gap-2 fb-rounded-md fb-bg-gray-800 fb-bg-opacity-40 fb-p-1.5 fb-text-white fb-opacity-0 fb-backdrop-blur-lg fb-transition fb-duration-300 fb-ease-in-out hover:fb-bg-opacity-65 group-hover/image:fb-opacity-100",
        children: /* @__PURE__ */ u$1(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: "20",
            height: "20",
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "1",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            class: "lucide lucide-expand",
            children: [
              /* @__PURE__ */ u$1("path", { d: "m21 21-6-6m6 6v-4.8m0 4.8h-4.8" }),
              /* @__PURE__ */ u$1("path", { d: "M3 16.2V21m0 0h4.8M3 21l6-6" }),
              /* @__PURE__ */ u$1("path", { d: "M21 7.8V3m0 0h-4.8M21 3l-6 6" }),
              /* @__PURE__ */ u$1("path", { d: "M3 7.8V3m0 0h4.8M3 3l6 6" })
            ]
          }
        )
      }
    )
  ] });
};
const Subheader = ({ subheader, questionId }) => {
  return /* @__PURE__ */ u$1(
    "p",
    {
      htmlFor: questionId,
      className: "fb-text-subheading fb-block fb-break-words fb-text-sm fb-font-normal fb-leading-5",
      dir: "auto",
      children: subheader
    }
  );
};
const ScrollableContainer = ({ children }) => {
  const [isOverflowHidden, setIsOverflowHidden] = h(true);
  const [isAtBottom, setIsAtBottom] = h(false);
  const [isAtTop, setIsAtTop] = h(false);
  const containerRef = A$1(null);
  const timeoutRef = A$1(null);
  const isSurveyPreview = !!document.getElementById("survey-preview");
  const checkScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(Math.round(scrollTop) + clientHeight >= scrollHeight);
    setIsAtTop(scrollTop === 0);
  };
  const toggleOverflow = (hide) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (hide) {
      timeoutRef.current = setTimeout(() => setIsOverflowHidden(true), 1e3);
    } else {
      setIsOverflowHidden(false);
      checkScroll();
    }
  };
  y(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleScroll = () => checkScroll();
    element.addEventListener("scroll", handleScroll);
    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, []);
  y(() => {
    checkScroll();
  }, [children]);
  return /* @__PURE__ */ u$1("div", { className: "fb-relative", children: [
    !isAtTop && /* @__PURE__ */ u$1("div", { className: "fb-from-survey-bg fb-absolute fb-left-0 fb-right-2 fb-top-0 fb-z-10 fb-h-4 fb-bg-gradient-to-b fb-to-transparent" }),
    /* @__PURE__ */ u$1(
      "div",
      {
        ref: containerRef,
        style: {
          scrollbarGutter: "stable both-edges",
          maxHeight: isSurveyPreview ? "40dvh" : "60dvh"
        },
        className: cn(
          "fb-overflow-auto fb-px-4 fb-pb-1",
          isOverflowHidden ? "fb-no-scrollbar" : "fb-bg-survey-bg"
        ),
        onMouseEnter: () => toggleOverflow(false),
        onMouseLeave: () => toggleOverflow(true),
        children
      }
    ),
    !isAtBottom && /* @__PURE__ */ u$1("div", { className: "fb-from-survey-bg fb-absolute -fb-bottom-2 fb-left-0 fb-right-2 fb-h-8 fb-bg-gradient-to-t fb-to-transparent" })
  ] });
};
const VOID = -1;
const PRIMITIVE = 0;
const ARRAY = 1;
const OBJECT = 2;
const DATE = 3;
const REGEXP = 4;
const MAP = 5;
const SET = 6;
const ERROR = 7;
const BIGINT = 8;
const env = typeof self === "object" ? self : globalThis;
const deserializer = ($2, _2) => {
  const as = (out, index) => {
    $2.set(index, out);
    return out;
  };
  const unpair = (index) => {
    if ($2.has(index))
      return $2.get(index);
    const [type, value] = _2[index];
    switch (type) {
      case PRIMITIVE:
      case VOID:
        return as(value, index);
      case ARRAY: {
        const arr = as([], index);
        for (const index2 of value)
          arr.push(unpair(index2));
        return arr;
      }
      case OBJECT: {
        const object = as({}, index);
        for (const [key, index2] of value)
          object[unpair(key)] = unpair(index2);
        return object;
      }
      case DATE:
        return as(new Date(value), index);
      case REGEXP: {
        const { source, flags } = value;
        return as(new RegExp(source, flags), index);
      }
      case MAP: {
        const map = as(/* @__PURE__ */ new Map(), index);
        for (const [key, index2] of value)
          map.set(unpair(key), unpair(index2));
        return map;
      }
      case SET: {
        const set = as(/* @__PURE__ */ new Set(), index);
        for (const index2 of value)
          set.add(unpair(index2));
        return set;
      }
      case ERROR: {
        const { name, message } = value;
        return as(new env[name](message), index);
      }
      case BIGINT:
        return as(BigInt(value), index);
      case "BigInt":
        return as(Object(BigInt(value)), index);
    }
    return as(new env[type](value), index);
  };
  return unpair;
};
const deserialize = (serialized) => deserializer(/* @__PURE__ */ new Map(), serialized)(0);
const EMPTY = "";
const { toString } = {};
const { keys } = Object;
const typeOf = (value) => {
  const type = typeof value;
  if (type !== "object" || !value)
    return [PRIMITIVE, type];
  const asString = toString.call(value).slice(8, -1);
  switch (asString) {
    case "Array":
      return [ARRAY, EMPTY];
    case "Object":
      return [OBJECT, EMPTY];
    case "Date":
      return [DATE, EMPTY];
    case "RegExp":
      return [REGEXP, EMPTY];
    case "Map":
      return [MAP, EMPTY];
    case "Set":
      return [SET, EMPTY];
  }
  if (asString.includes("Array"))
    return [ARRAY, asString];
  if (asString.includes("Error"))
    return [ERROR, asString];
  return [OBJECT, asString];
};
const shouldSkip = ([TYPE, type]) => TYPE === PRIMITIVE && (type === "function" || type === "symbol");
const serializer = (strict, json, $2, _2) => {
  const as = (out, value) => {
    const index = _2.push(out) - 1;
    $2.set(value, index);
    return index;
  };
  const pair = (value) => {
    if ($2.has(value))
      return $2.get(value);
    let [TYPE, type] = typeOf(value);
    switch (TYPE) {
      case PRIMITIVE: {
        let entry = value;
        switch (type) {
          case "bigint":
            TYPE = BIGINT;
            entry = value.toString();
            break;
          case "function":
          case "symbol":
            if (strict)
              throw new TypeError("unable to serialize " + type);
            entry = null;
            break;
          case "undefined":
            return as([VOID], value);
        }
        return as([TYPE, entry], value);
      }
      case ARRAY: {
        if (type)
          return as([type, [...value]], value);
        const arr = [];
        const index = as([TYPE, arr], value);
        for (const entry of value)
          arr.push(pair(entry));
        return index;
      }
      case OBJECT: {
        if (type) {
          switch (type) {
            case "BigInt":
              return as([type, value.toString()], value);
            case "Boolean":
            case "Number":
            case "String":
              return as([type, value.valueOf()], value);
          }
        }
        if (json && "toJSON" in value)
          return pair(value.toJSON());
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const key of keys(value)) {
          if (strict || !shouldSkip(typeOf(value[key])))
            entries.push([pair(key), pair(value[key])]);
        }
        return index;
      }
      case DATE:
        return as([TYPE, value.toISOString()], value);
      case REGEXP: {
        const { source, flags } = value;
        return as([TYPE, { source, flags }], value);
      }
      case MAP: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const [key, entry] of value) {
          if (strict || !(shouldSkip(typeOf(key)) || shouldSkip(typeOf(entry))))
            entries.push([pair(key), pair(entry)]);
        }
        return index;
      }
      case SET: {
        const entries = [];
        const index = as([TYPE, entries], value);
        for (const entry of value) {
          if (strict || !shouldSkip(typeOf(entry)))
            entries.push(pair(entry));
        }
        return index;
      }
    }
    const { message } = value;
    return as([TYPE, { name: type, message }], value);
  };
  return pair;
};
const serialize = (value, { json, lossy } = {}) => {
  const _2 = [];
  return serializer(!(json || lossy), !!json, /* @__PURE__ */ new Map(), _2)(value), _2;
};
const structuredClonePolyfill = typeof structuredClone === "function" ? (
  /* c8 ignore start */
  (any, options2) => options2 && ("json" in options2 || "lossy" in options2) ? deserialize(serialize(any, options2)) : structuredClone(any)
) : (any, options2) => deserialize(serialize(any, options2));
let structuredCloneExport;
if (typeof structuredClone === "undefined") {
  structuredCloneExport = structuredClonePolyfill;
} else {
  structuredCloneExport = structuredClone;
}
const isI18nObject = (obj) => {
  return typeof obj === "object" && obj !== null && Object.keys(obj).includes("default");
};
const getLocalizedValue = (value, languageId) => {
  if (!value) {
    return "";
  }
  if (isI18nObject(value)) {
    if (value[languageId]) {
      return value[languageId];
    }
    return "";
  }
  return "";
};
const iso639Languages = [
  {
    alpha2: "aa",
    english: "Afar"
  },
  {
    alpha2: "ab",
    english: "Abkhazian"
  },
  {
    alpha2: "ae",
    english: "Avestan"
  },
  {
    alpha2: "af",
    english: "Afrikaans"
  },
  {
    alpha2: "ak",
    english: "Akan"
  },
  {
    alpha2: "am",
    english: "Amharic"
  },
  {
    alpha2: "an",
    english: "Aragonese"
  },
  {
    alpha2: "ar",
    english: "Arabic"
  },
  {
    alpha2: "as",
    english: "Assamese"
  },
  {
    alpha2: "av",
    english: "Avaric"
  },
  {
    alpha2: "ay",
    english: "Aymara"
  },
  {
    alpha2: "az",
    english: "Azerbaijani"
  },
  {
    alpha2: "ba",
    english: "Bashkir"
  },
  {
    alpha2: "be",
    english: "Belarusian"
  },
  {
    alpha2: "bg",
    english: "Bulgarian"
  },
  {
    alpha2: "bh",
    english: "Bihari languages"
  },
  {
    alpha2: "bi",
    english: "Bislama"
  },
  {
    alpha2: "bm",
    english: "Bambara"
  },
  {
    alpha2: "bn",
    english: "Bengali"
  },
  {
    alpha2: "bo",
    english: "Tibetan"
  },
  {
    alpha2: "br",
    english: "Breton"
  },
  {
    alpha2: "bs",
    english: "Bosnian"
  },
  {
    alpha2: "ca",
    english: "Catalan; Valencian"
  },
  {
    alpha2: "ce",
    english: "Chechen"
  },
  {
    alpha2: "ch",
    english: "Chamorro"
  },
  {
    alpha2: "co",
    english: "Corsican"
  },
  {
    alpha2: "cr",
    english: "Cree"
  },
  {
    alpha2: "cs",
    english: "Czech"
  },
  {
    alpha2: "cu",
    english: "Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic"
  },
  {
    alpha2: "cv",
    english: "Chuvash"
  },
  {
    alpha2: "cy",
    english: "Welsh"
  },
  {
    alpha2: "da",
    english: "Danish"
  },
  {
    alpha2: "de",
    english: "German"
  },
  {
    alpha2: "dv",
    english: "Divehi; Dhivehi; Maldivian"
  },
  {
    alpha2: "dz",
    english: "Dzongkha"
  },
  {
    alpha2: "ee",
    english: "Ewe"
  },
  {
    alpha2: "el",
    english: "Greek, Modern (1453-)"
  },
  {
    alpha2: "en",
    english: "English"
  },
  {
    alpha2: "eo",
    english: "Esperanto"
  },
  {
    alpha2: "es",
    english: "Spanish; Castilian"
  },
  {
    alpha2: "et",
    english: "Estonian"
  },
  {
    alpha2: "eu",
    english: "Basque"
  },
  {
    alpha2: "fa",
    english: "Persian"
  },
  {
    alpha2: "ff",
    english: "Fulah"
  },
  {
    alpha2: "fi",
    english: "Finnish"
  },
  {
    alpha2: "fj",
    english: "Fijian"
  },
  {
    alpha2: "fo",
    english: "Faroese"
  },
  {
    alpha2: "fr",
    english: "French"
  },
  {
    alpha2: "fy",
    english: "Western Frisian"
  },
  {
    alpha2: "ga",
    english: "Irish"
  },
  {
    alpha2: "gd",
    english: "Gaelic; Scottish Gaelic"
  },
  {
    alpha2: "gl",
    english: "Galician"
  },
  {
    alpha2: "gn",
    english: "Guarani"
  },
  {
    alpha2: "gu",
    english: "Gujarati"
  },
  {
    alpha2: "gv",
    english: "Manx"
  },
  {
    alpha2: "ha",
    english: "Hausa"
  },
  {
    alpha2: "he",
    english: "Hebrew"
  },
  {
    alpha2: "hi",
    english: "Hindi"
  },
  {
    alpha2: "ho",
    english: "Hiri Motu"
  },
  {
    alpha2: "hr",
    english: "Croatian"
  },
  {
    alpha2: "ht",
    english: "Haitian; Haitian Creole"
  },
  {
    alpha2: "hu",
    english: "Hungarian"
  },
  {
    alpha2: "hy",
    english: "Armenian"
  },
  {
    alpha2: "hz",
    english: "Herero"
  },
  {
    alpha2: "ia",
    english: "Interlingua (International Auxiliary Language Association)"
  },
  {
    alpha2: "id",
    english: "Indonesian"
  },
  {
    alpha2: "ie",
    english: "Interlingue; Occidental"
  },
  {
    alpha2: "ig",
    english: "Igbo"
  },
  {
    alpha2: "ii",
    english: "Sichuan Yi; Nuosu"
  },
  {
    alpha2: "ik",
    english: "Inupiaq"
  },
  {
    alpha2: "io",
    english: "Ido"
  },
  {
    alpha2: "is",
    english: "Icelandic"
  },
  {
    alpha2: "it",
    english: "Italian"
  },
  {
    alpha2: "iu",
    english: "Inuktitut"
  },
  {
    alpha2: "ja",
    english: "Japanese"
  },
  {
    alpha2: "jv",
    english: "Javanese"
  },
  {
    alpha2: "ka",
    english: "Georgian"
  },
  {
    alpha2: "kg",
    english: "Kongo"
  },
  {
    alpha2: "ki",
    english: "Kikuyu; Gikuyu"
  },
  {
    alpha2: "kj",
    english: "Kuanyama; Kwanyama"
  },
  {
    alpha2: "kk",
    english: "Kazakh"
  },
  {
    alpha2: "kl",
    english: "Kalaallisut; Greenlandic"
  },
  {
    alpha2: "km",
    english: "Central Khmer"
  },
  {
    alpha2: "kn",
    english: "Kannada"
  },
  {
    alpha2: "ko",
    english: "Korean"
  },
  {
    alpha2: "kr",
    english: "Kanuri"
  },
  {
    alpha2: "ks",
    english: "Kashmiri"
  },
  {
    alpha2: "ku",
    english: "Kurdish"
  },
  {
    alpha2: "kv",
    english: "Komi"
  },
  {
    alpha2: "kw",
    english: "Cornish"
  },
  {
    alpha2: "ky",
    english: "Kirghiz; Kyrgyz"
  },
  {
    alpha2: "la",
    english: "Latin"
  },
  {
    alpha2: "lb",
    english: "Luxembourgish; Letzeburgesch"
  },
  {
    alpha2: "lg",
    english: "Ganda"
  },
  {
    alpha2: "li",
    english: "Limburgan; Limburger; Limburgish"
  },
  {
    alpha2: "ln",
    english: "Lingala"
  },
  {
    alpha2: "lo",
    english: "Lao"
  },
  {
    alpha2: "lt",
    english: "Lithuanian"
  },
  {
    alpha2: "lu",
    english: "Luba-Katanga"
  },
  {
    alpha2: "lv",
    english: "Latvian"
  },
  {
    alpha2: "mg",
    english: "Malagasy"
  },
  {
    alpha2: "mh",
    english: "Marshallese"
  },
  {
    alpha2: "mi",
    english: "Maori"
  },
  {
    alpha2: "mk",
    english: "Macedonian"
  },
  {
    alpha2: "ml",
    english: "Malayalam"
  },
  {
    alpha2: "mn",
    english: "Mongolian"
  },
  {
    alpha2: "mr",
    english: "Marathi"
  },
  {
    alpha2: "ms",
    english: "Malay"
  },
  {
    alpha2: "mt",
    english: "Maltese"
  },
  {
    alpha2: "my",
    english: "Burmese"
  },
  {
    alpha2: "na",
    english: "Nauru"
  },
  {
    alpha2: "nb",
    english: "Bokmål, Norwegian; Norwegian Bokmål"
  },
  {
    alpha2: "nd",
    english: "Ndebele, North; North Ndebele"
  },
  {
    alpha2: "ne",
    english: "Nepali"
  },
  {
    alpha2: "ng",
    english: "Ndonga"
  },
  {
    alpha2: "nl",
    english: "Dutch; Flemish"
  },
  {
    alpha2: "nn",
    english: "Norwegian Nynorsk; Nynorsk, Norwegian"
  },
  {
    alpha2: "no",
    english: "Norwegian"
  },
  {
    alpha2: "nr",
    english: "Ndebele, South; South Ndebele"
  },
  {
    alpha2: "nv",
    english: "Navajo; Navaho"
  },
  {
    alpha2: "ny",
    english: "Chichewa; Chewa; Nyanja"
  },
  {
    alpha2: "oc",
    english: "Occitan (post 1500)"
  },
  {
    alpha2: "oj",
    english: "Ojibwa"
  },
  {
    alpha2: "om",
    english: "Oromo"
  },
  {
    alpha2: "or",
    english: "Oriya"
  },
  {
    alpha2: "os",
    english: "Ossetian; Ossetic"
  },
  {
    alpha2: "pa",
    english: "Panjabi; Punjabi"
  },
  {
    alpha2: "pi",
    english: "Pali"
  },
  {
    alpha2: "pl",
    english: "Polish"
  },
  {
    alpha2: "ps",
    english: "Pushto; Pashto"
  },
  {
    alpha2: "pt",
    english: "Portuguese"
  },
  {
    alpha2: "qu",
    english: "Quechua"
  },
  {
    alpha2: "rm",
    english: "Romansh"
  },
  {
    alpha2: "rn",
    english: "Rundi"
  },
  {
    alpha2: "ro",
    english: "Romanian; Moldavian; Moldovan"
  },
  {
    alpha2: "ru",
    english: "Russian"
  },
  {
    alpha2: "rw",
    english: "Kinyarwanda"
  },
  {
    alpha2: "sa",
    english: "Sanskrit"
  },
  {
    alpha2: "sc",
    english: "Sardinian"
  },
  {
    alpha2: "sd",
    english: "Sindhi"
  },
  {
    alpha2: "se",
    english: "Northern Sami"
  },
  {
    alpha2: "sg",
    english: "Sango"
  },
  {
    alpha2: "si",
    english: "Sinhala; Sinhalese"
  },
  {
    alpha2: "sk",
    english: "Slovak"
  },
  {
    alpha2: "sl",
    english: "Slovenian"
  },
  {
    alpha2: "sm",
    english: "Samoan"
  },
  {
    alpha2: "sn",
    english: "Shona"
  },
  {
    alpha2: "so",
    english: "Somali"
  },
  {
    alpha2: "sq",
    english: "Albanian"
  },
  {
    alpha2: "sr",
    english: "Serbian"
  },
  {
    alpha2: "ss",
    english: "Swati"
  },
  {
    alpha2: "st",
    english: "Sotho, Southern"
  },
  {
    alpha2: "su",
    english: "Sundanese"
  },
  {
    alpha2: "sv",
    english: "Swedish"
  },
  {
    alpha2: "sw",
    english: "Swahili"
  },
  {
    alpha2: "ta",
    english: "Tamil"
  },
  {
    alpha2: "te",
    english: "Telugu"
  },
  {
    alpha2: "tg",
    english: "Tajik"
  },
  {
    alpha2: "th",
    english: "Thai"
  },
  {
    alpha2: "ti",
    english: "Tigrinya"
  },
  {
    alpha2: "tk",
    english: "Turkmen"
  },
  {
    alpha2: "tl",
    english: "Tagalog"
  },
  {
    alpha2: "tn",
    english: "Tswana"
  },
  {
    alpha2: "to",
    english: "Tonga (Tonga Islands)"
  },
  {
    alpha2: "tr",
    english: "Turkish"
  },
  {
    alpha2: "ts",
    english: "Tsonga"
  },
  {
    alpha2: "tt",
    english: "Tatar"
  },
  {
    alpha2: "tw",
    english: "Twi"
  },
  {
    alpha2: "ty",
    english: "Tahitian"
  },
  {
    alpha2: "ug",
    english: "Uighur; Uyghur"
  },
  {
    alpha2: "uk",
    english: "Ukrainian"
  },
  {
    alpha2: "ur",
    english: "Urdu"
  },
  {
    alpha2: "uz",
    english: "Uzbek"
  },
  {
    alpha2: "ve",
    english: "Venda"
  },
  {
    alpha2: "vi",
    english: "Vietnamese"
  },
  {
    alpha2: "vo",
    english: "Volapük"
  },
  {
    alpha2: "wa",
    english: "Walloon"
  },
  {
    alpha2: "wo",
    english: "Wolof"
  },
  {
    alpha2: "xh",
    english: "Xhosa"
  },
  {
    alpha2: "yi",
    english: "Yiddish"
  },
  {
    alpha2: "yo",
    english: "Yoruba"
  },
  {
    alpha2: "za",
    english: "Zhuang; Chuang"
  },
  {
    alpha2: "zh-Hans",
    english: "Chinese (Simplified)"
  },
  {
    alpha2: "zh-Hant",
    english: "Chinese (Traditional)"
  },
  {
    alpha2: "zu",
    english: "Zulu"
  }
];
iso639Languages.map((language) => language.alpha2);
const getLanguageLabel = (languageCode) => {
  const language = iso639Languages.find((lang) => lang.alpha2 === languageCode);
  return `${language == null ? void 0 : language.english}`;
};
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
const getMonthName = (monthIndex) => {
  return monthNames[monthIndex];
};
const formatDateWithOrdinal = (date) => {
  const getOrdinalSuffix = (day2) => {
    const suffixes = ["th", "st", "nd", "rd"];
    const relevantDigits = day2 < 30 ? day2 % 20 : day2 % 30;
    return suffixes[relevantDigits <= 3 ? relevantDigits : 0];
  };
  const dayOfWeekNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = dayOfWeekNames[date.getDay()];
  const day = date.getDate();
  const monthIndex = date.getMonth();
  const year = date.getFullYear();
  return `${dayOfWeek}, ${monthNames[monthIndex]} ${day}${getOrdinalSuffix(day)}, ${year}`;
};
const getOrdinalDate = (date) => {
  const j2 = date % 10, k2 = date % 100;
  if (j2 === 1 && k2 !== 11) {
    return date + "st";
  }
  if (j2 === 2 && k2 !== 12) {
    return date + "nd";
  }
  if (j2 === 3 && k2 !== 13) {
    return date + "rd";
  }
  return date + "th";
};
const isValidDateString = (value) => {
  const regex = /^(?:\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4})$/;
  if (!regex.test(value)) {
    return false;
  }
  const date = new Date(value);
  return date;
};
const extractId = (text) => {
  const pattern = /#recall:([A-Za-z0-9_-]+)/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return null;
  }
};
const extractFallbackValue = (text) => {
  const pattern = /fallback:(\S*)#/;
  const match = text.match(pattern);
  if (match && match[1]) {
    return match[1];
  } else {
    return "";
  }
};
const extractRecallInfo = (headline, id) => {
  const idPattern = "[A-Za-z0-9_-]+";
  const pattern = new RegExp(`#recall:(${idPattern})\\/fallback:(\\S*)#`);
  const match = headline.match(pattern);
  return match ? match[0] : null;
};
const replaceRecallInfo = (text, responseData, variables) => {
  let modifiedText = text;
  while (modifiedText.includes("recall:")) {
    const recallInfo = extractRecallInfo(modifiedText);
    if (!recallInfo) break;
    const recallItemId = extractId(recallInfo);
    if (!recallItemId) return modifiedText;
    const fallback = extractFallbackValue(recallInfo).replaceAll("nbsp", " ");
    let value = null;
    if (variables[recallItemId] !== void 0) {
      value = String(variables[recallItemId]) ?? fallback;
    }
    if (responseData[recallItemId]) {
      value = responseData[recallItemId] ?? fallback;
    }
    if (value) {
      if (isValidDateString(value)) {
        value = formatDateWithOrdinal(new Date(value));
      } else if (Array.isArray(value)) {
        value = value.filter((item) => item).join(", ");
      }
    }
    modifiedText = modifiedText.replace(recallInfo, value || fallback);
  }
  return modifiedText;
};
const parseRecallInformation = (question, languageCode, responseData, variables) => {
  var _a2, _b;
  const modifiedQuestion = structuredCloneExport(question);
  if (question.headline && ((_a2 = question.headline[languageCode]) == null ? void 0 : _a2.includes("recall:"))) {
    modifiedQuestion.headline[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.headline, languageCode),
      responseData,
      variables
    );
  }
  if (question.subheader && ((_b = question.subheader[languageCode]) == null ? void 0 : _b.includes("recall:")) && modifiedQuestion.subheader) {
    modifiedQuestion.subheader[languageCode] = replaceRecallInfo(
      getLocalizedValue(modifiedQuestion.subheader, languageCode),
      responseData,
      variables
    );
  }
  return modifiedQuestion;
};
const EndingCard = ({
  survey,
  endingCard,
  isRedirectDisabled,
  isResponseSendingFinished,
  autoFocusEnabled,
  isCurrent,
  languageCode,
  responseData,
  variablesData
}) => {
  const media = endingCard.type === "endScreen" && (endingCard.imageUrl || endingCard.videoUrl) ? /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: endingCard.imageUrl, videoUrl: endingCard.videoUrl }) : null;
  const checkmark = /* @__PURE__ */ u$1("div", { className: "fb-text-brand fb-flex fb-flex-col fb-items-center fb-justify-center", children: [
    /* @__PURE__ */ u$1(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        fill: "none",
        viewBox: "0 0 24 24",
        strokeWidth: "1.5",
        stroke: "currentColor",
        class: "fb-h-24 fb-w-24",
        children: /* @__PURE__ */ u$1(
          "path",
          {
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            d: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          }
        )
      }
    ),
    /* @__PURE__ */ u$1("span", { className: "fb-bg-brand fb-mb-[10px] fb-inline-block fb-h-1 fb-w-16 fb-rounded-[100%]" })
  ] });
  const handleSubmit = () => {
    var _a2;
    if (!isRedirectDisabled && endingCard.type === "endScreen" && endingCard.buttonLink) {
      (_a2 = window.top) == null ? void 0 : _a2.location.replace(endingCard.buttonLink);
    }
  };
  y(() => {
    var _a2;
    if (isCurrent) {
      if (!isRedirectDisabled && endingCard.type === "redirectToUrl" && endingCard.url) {
        (_a2 = window.top) == null ? void 0 : _a2.location.replace(endingCard.url);
      }
    }
    const handleEnter = (e2) => {
      if (e2.key === "Enter") {
        handleSubmit();
      }
    };
    if (isCurrent && survey.type === "link") {
      document.addEventListener("keydown", handleEnter);
    } else {
      document.removeEventListener("keydown", handleEnter);
    }
    return () => {
      document.removeEventListener("keydown", handleEnter);
    };
  }, [isCurrent]);
  return /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { className: "fb-text-center", children: isResponseSendingFinished ? /* @__PURE__ */ u$1(b, { children: [
    endingCard.type === "endScreen" && (media || checkmark),
    /* @__PURE__ */ u$1("div", { children: [
      /* @__PURE__ */ u$1(
        Headline,
        {
          alignTextCenter: true,
          headline: endingCard.type === "endScreen" ? replaceRecallInfo(
            getLocalizedValue(endingCard.headline, languageCode),
            responseData,
            variablesData
          ) : "Respondants will not see this card",
          questionId: "EndingCard"
        }
      ),
      /* @__PURE__ */ u$1(
        Subheader,
        {
          subheader: endingCard.type === "endScreen" ? replaceRecallInfo(
            getLocalizedValue(endingCard.subheader, languageCode),
            responseData,
            variablesData
          ) : "They will be forwarded immediately",
          questionId: "EndingCard"
        }
      ),
      endingCard.type === "endScreen" && endingCard.buttonLabel && /* @__PURE__ */ u$1("div", { className: "fb-mt-6 fb-flex fb-w-full fb-flex-col fb-items-center fb-justify-center fb-space-y-4", children: /* @__PURE__ */ u$1(
        SubmitButton,
        {
          buttonLabel: replaceRecallInfo(
            getLocalizedValue(endingCard.buttonLabel, languageCode),
            responseData,
            variablesData
          ),
          isLastQuestion: false,
          focus: autoFocusEnabled,
          onClick: handleSubmit
        }
      ) })
    ] })
  ] }) : /* @__PURE__ */ u$1(b, { children: [
    /* @__PURE__ */ u$1("div", { className: "fb-my-3", children: /* @__PURE__ */ u$1(LoadingSpinner, {}) }),
    /* @__PURE__ */ u$1("h1", { className: "fb-text-brand", children: "Sending responses..." })
  ] }) }) });
};
const FormbricksBranding = () => {
  return /* @__PURE__ */ u$1(
    "a",
    {
      href: "https://formbricks.com?utm_source=survey_branding",
      target: "_blank",
      tabIndex: -1,
      className: "fb-my-2 fb-flex fb-justify-center",
      children: /* @__PURE__ */ u$1("p", { className: "fb-text-signature fb-text-xs", children: [
        "Powered by",
        " ",
        /* @__PURE__ */ u$1("b", { children: /* @__PURE__ */ u$1("span", { className: "fb-text-branding-text hover:fb-text-signature", children: "Formbricks" }) })
      ] })
    }
  );
};
const GlobeIcon = ({ className: className2 }) => {
  return /* @__PURE__ */ u$1(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      className: className2,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "1",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: "lucide lucide-globe",
      children: [
        /* @__PURE__ */ u$1("circle", { cx: "12", cy: "12", r: "10" }),
        /* @__PURE__ */ u$1("path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }),
        /* @__PURE__ */ u$1("path", { d: "M2 12h20" })
      ]
    }
  );
};
function g(n2, t2) {
  for (var e2 in t2) n2[e2] = t2[e2];
  return n2;
}
function E(n2, t2) {
  for (var e2 in n2) if ("__source" !== e2 && !(e2 in t2)) return true;
  for (var r2 in t2) if ("__source" !== r2 && n2[r2] !== t2[r2]) return true;
  return false;
}
function C(n2, t2) {
  this.props = n2, this.context = t2;
}
(C.prototype = new k$2()).isPureReactComponent = true, C.prototype.shouldComponentUpdate = function(n2, t2) {
  return E(this.props, n2) || E(this.state, t2);
};
var R = l$2.__b;
l$2.__b = function(n2) {
  n2.type && n2.type.__f && n2.ref && (n2.props.ref = n2.ref, n2.ref = null), R && R(n2);
};
var w = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.forward_ref") || 3911;
function k(n2) {
  function t2(t3) {
    var e2 = g({}, t3);
    return delete e2.ref, n2(e2, t3.ref || null);
  }
  return t2.$$typeof = w, t2.render = t2, t2.prototype.isReactComponent = t2.__f = true, t2.displayName = "ForwardRef(" + (n2.displayName || n2.name) + ")", t2;
}
var I = function(n2, t2) {
  return null == n2 ? null : H$1(H$1(n2).map(t2));
}, N = { map: I, forEach: I, count: function(n2) {
  return n2 ? H$1(n2).length : 0;
}, only: function(n2) {
  var t2 = H$1(n2);
  if (1 !== t2.length) throw "Children.only";
  return t2[0];
}, toArray: H$1 }, M = l$2.__e;
l$2.__e = function(n2, t2, e2, r2) {
  if (n2.then) {
    for (var u2, o2 = t2; o2 = o2.__; ) if ((u2 = o2.__c) && u2.__c) return null == t2.__e && (t2.__e = e2.__e, t2.__k = e2.__k), u2.__c(n2, t2);
  }
  M(n2, t2, e2, r2);
};
var T = l$2.unmount;
function A(n2, t2, e2) {
  return n2 && (n2.__c && n2.__c.__H && (n2.__c.__H.__.forEach(function(n3) {
    "function" == typeof n3.__c && n3.__c();
  }), n2.__c.__H = null), null != (n2 = g({}, n2)).__c && (n2.__c.__P === e2 && (n2.__c.__P = t2), n2.__c = null), n2.__k = n2.__k && n2.__k.map(function(n3) {
    return A(n3, t2, e2);
  })), n2;
}
function D(n2, t2, e2) {
  return n2 && e2 && (n2.__v = null, n2.__k = n2.__k && n2.__k.map(function(n3) {
    return D(n3, t2, e2);
  }), n2.__c && n2.__c.__P === t2 && (n2.__e && e2.appendChild(n2.__e), n2.__c.__e = true, n2.__c.__P = e2)), n2;
}
function L() {
  this.__u = 0, this.t = null, this.__b = null;
}
function O(n2) {
  var t2 = n2.__.__c;
  return t2 && t2.__a && t2.__a(n2);
}
function U() {
  this.u = null, this.o = null;
}
l$2.unmount = function(n2) {
  var t2 = n2.__c;
  t2 && t2.__R && t2.__R(), t2 && 32 & n2.__u && (n2.type = null), T && T(n2);
}, (L.prototype = new k$2()).__c = function(n2, t2) {
  var e2 = t2.__c, r2 = this;
  null == r2.t && (r2.t = []), r2.t.push(e2);
  var u2 = O(r2.__v), o2 = false, i2 = function() {
    o2 || (o2 = true, e2.__R = null, u2 ? u2(c2) : c2());
  };
  e2.__R = i2;
  var c2 = function() {
    if (!--r2.__u) {
      if (r2.state.__a) {
        var n3 = r2.state.__a;
        r2.__v.__k[0] = D(n3, n3.__c.__P, n3.__c.__O);
      }
      var t3;
      for (r2.setState({ __a: r2.__b = null }); t3 = r2.t.pop(); ) t3.forceUpdate();
    }
  };
  r2.__u++ || 32 & t2.__u || r2.setState({ __a: r2.__b = r2.__v.__k[0] }), n2.then(i2, i2);
}, L.prototype.componentWillUnmount = function() {
  this.t = [];
}, L.prototype.render = function(n2, e2) {
  if (this.__b) {
    if (this.__v.__k) {
      var r2 = document.createElement("div"), o2 = this.__v.__k[0].__c;
      this.__v.__k[0] = A(this.__b, r2, o2.__O = o2.__P);
    }
    this.__b = null;
  }
  var i2 = e2.__a && _$1(b, null, n2.fallback);
  return i2 && (i2.__u &= -33), [_$1(b, null, e2.__a ? null : n2.children), i2];
};
var V = function(n2, t2, e2) {
  if (++e2[1] === e2[0] && n2.o.delete(t2), n2.props.revealOrder && ("t" !== n2.props.revealOrder[0] || !n2.o.size)) for (e2 = n2.u; e2; ) {
    for (; e2.length > 3; ) e2.pop()();
    if (e2[1] < e2[0]) break;
    n2.u = e2 = e2[2];
  }
};
function W(n2) {
  return this.getChildContext = function() {
    return n2.context;
  }, n2.children;
}
function P(n2) {
  var e2 = this, r2 = n2.i;
  e2.componentWillUnmount = function() {
    B$2(null, e2.l), e2.l = null, e2.i = null;
  }, e2.i && e2.i !== r2 && e2.componentWillUnmount(), e2.l || (e2.i = r2, e2.l = { nodeType: 1, parentNode: r2, childNodes: [], contains: function() {
    return true;
  }, appendChild: function(n3) {
    this.childNodes.push(n3), e2.i.appendChild(n3);
  }, insertBefore: function(n3, t2) {
    this.childNodes.push(n3), e2.i.appendChild(n3);
  }, removeChild: function(n3) {
    this.childNodes.splice(this.childNodes.indexOf(n3) >>> 1, 1), e2.i.removeChild(n3);
  } }), B$2(_$1(W, { context: e2.context }, n2.__v), e2.l);
}
function j(n2, e2) {
  var r2 = _$1(P, { __v: n2, i: e2 });
  return r2.containerInfo = e2, r2;
}
(U.prototype = new k$2()).__a = function(n2) {
  var t2 = this, e2 = O(t2.__v), r2 = t2.o.get(n2);
  return r2[0]++, function(u2) {
    var o2 = function() {
      t2.props.revealOrder ? (r2.push(u2), V(t2, n2, r2)) : u2();
    };
    e2 ? e2(o2) : o2();
  };
}, U.prototype.render = function(n2) {
  this.u = null, this.o = /* @__PURE__ */ new Map();
  var t2 = H$1(n2.children);
  n2.revealOrder && "b" === n2.revealOrder[0] && t2.reverse();
  for (var e2 = t2.length; e2--; ) this.o.set(t2[e2], this.u = [1, 0, this.u]);
  return n2.children;
}, U.prototype.componentDidUpdate = U.prototype.componentDidMount = function() {
  var n2 = this;
  this.o.forEach(function(t2, e2) {
    V(n2, e2, t2);
  });
};
var z$1 = "undefined" != typeof Symbol && Symbol.for && Symbol.for("react.element") || 60103, B = /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/, H = /^on(Ani|Tra|Tou|BeforeInp|Compo)/, Z = /[A-Z0-9]/g, Y = "undefined" != typeof document, $ = function(n2) {
  return ("undefined" != typeof Symbol && "symbol" == typeof Symbol() ? /fil|che|rad/ : /fil|che|ra/).test(n2);
};
k$2.prototype.isReactComponent = {}, ["componentWillMount", "componentWillReceiveProps", "componentWillUpdate"].forEach(function(t2) {
  Object.defineProperty(k$2.prototype, t2, { configurable: true, get: function() {
    return this["UNSAFE_" + t2];
  }, set: function(n2) {
    Object.defineProperty(this, t2, { configurable: true, writable: true, value: n2 });
  } });
});
var J = l$2.event;
function K() {
}
function Q() {
  return this.cancelBubble;
}
function X() {
  return this.defaultPrevented;
}
l$2.event = function(n2) {
  return J && (n2 = J(n2)), n2.persist = K, n2.isPropagationStopped = Q, n2.isDefaultPrevented = X, n2.nativeEvent = n2;
};
var tn = { enumerable: false, configurable: true, get: function() {
  return this.class;
} }, en = l$2.vnode;
l$2.vnode = function(n2) {
  "string" == typeof n2.type && function(n3) {
    var t2 = n3.props, e2 = n3.type, u2 = {}, o2 = -1 === e2.indexOf("-");
    for (var i2 in t2) {
      var c2 = t2[i2];
      if (!("value" === i2 && "defaultValue" in t2 && null == c2 || Y && "children" === i2 && "noscript" === e2 || "class" === i2 || "className" === i2)) {
        var l2 = i2.toLowerCase();
        "defaultValue" === i2 && "value" in t2 && null == t2.value ? i2 = "value" : "download" === i2 && true === c2 ? c2 = "" : "translate" === l2 && "no" === c2 ? c2 = false : "o" === l2[0] && "n" === l2[1] ? "ondoubleclick" === l2 ? i2 = "ondblclick" : "onchange" !== l2 || "input" !== e2 && "textarea" !== e2 || $(t2.type) ? "onfocus" === l2 ? i2 = "onfocusin" : "onblur" === l2 ? i2 = "onfocusout" : H.test(i2) && (i2 = l2) : l2 = i2 = "oninput" : o2 && B.test(i2) ? i2 = i2.replace(Z, "-$&").toLowerCase() : null === c2 && (c2 = void 0), "oninput" === l2 && u2[i2 = l2] && (i2 = "oninputCapture"), u2[i2] = c2;
      }
    }
    "select" == e2 && u2.multiple && Array.isArray(u2.value) && (u2.value = H$1(t2.children).forEach(function(n4) {
      n4.props.selected = -1 != u2.value.indexOf(n4.props.value);
    })), "select" == e2 && null != u2.defaultValue && (u2.value = H$1(t2.children).forEach(function(n4) {
      n4.props.selected = u2.multiple ? -1 != u2.defaultValue.indexOf(n4.props.value) : u2.defaultValue == n4.props.value;
    })), t2.class && !t2.className ? (u2.class = t2.class, Object.defineProperty(u2, "className", tn)) : (t2.className && !t2.class || t2.class && t2.className) && (u2.class = u2.className = t2.className), n3.props = u2;
  }(n2), n2.$$typeof = z$1, en && en(n2);
};
var rn = l$2.__r;
l$2.__r = function(n2) {
  rn && rn(n2), n2.__c;
};
var un = l$2.diffed;
l$2.diffed = function(n2) {
  un && un(n2);
  var t2 = n2.props, e2 = n2.__e;
  null != e2 && "textarea" === n2.type && "value" in t2 && t2.value !== e2.value && (e2.value = null == t2.value ? "" : t2.value);
};
function fn(n2) {
  return !!n2 && n2.$$typeof === z$1;
}
function hn(n2) {
  return fn(n2) ? E$1.apply(null, arguments) : n2;
}
const useClickOutside = (ref, handler) => {
  y(() => {
    let startedInside = false;
    let startedWhenMounted = false;
    const listener = (event) => {
      if (startedInside || !startedWhenMounted) return;
      if (!ref.current || ref.current.contains(event.target)) return;
      handler(event);
    };
    const validateEventStart = (event) => {
      startedWhenMounted = ref.current !== null;
      startedInside = ref.current !== null && ref.current.contains(event.target);
    };
    document.addEventListener("mousedown", validateEventStart);
    document.addEventListener("touchstart", validateEventStart);
    document.addEventListener("click", listener);
    return () => {
      document.removeEventListener("mousedown", validateEventStart);
      document.removeEventListener("touchstart", validateEventStart);
      document.removeEventListener("click", listener);
    };
  }, [ref, handler]);
};
const LanguageSwitch = ({
  surveyLanguages,
  setSelectedLanguageCode,
  setFirstRender
}) => {
  var _a2;
  const [showLanguageDropdown, setShowLanguageDropdown] = h(false);
  const toggleDropdown = () => setShowLanguageDropdown((prev) => !prev);
  const languageDropdownRef = A$1(null);
  const defaultLanguageCode = (_a2 = surveyLanguages.find((surveyLanguage) => {
    return surveyLanguage.default === true;
  })) == null ? void 0 : _a2.language.code;
  const changeLanguage = (languageCode) => {
    if (languageCode === defaultLanguageCode) {
      setSelectedLanguageCode("default");
    } else {
      setSelectedLanguageCode(languageCode);
    }
    if (setFirstRender) {
      setFirstRender(true);
    }
    setShowLanguageDropdown(false);
  };
  useClickOutside(languageDropdownRef, () => setShowLanguageDropdown(false));
  return /* @__PURE__ */ u$1("div", { class: "fb-z-[1001] fb-flex fb-w-fit fb-items-center even:fb-pr-1", children: [
    /* @__PURE__ */ u$1(
      "button",
      {
        title: "Language switch",
        type: "button",
        class: "fb-text-heading fb-relative fb-h-5 fb-w-5 fb-rounded-md hover:fb-bg-black/5 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2",
        onClick: toggleDropdown,
        tabIndex: -1,
        "aria-haspopup": "true",
        "aria-expanded": showLanguageDropdown,
        children: /* @__PURE__ */ u$1(GlobeIcon, { className: "fb-text-heading fb-h-5 fb-w-5 fb-p-0.5" })
      }
    ),
    showLanguageDropdown && /* @__PURE__ */ u$1(
      "div",
      {
        className: "fb-bg-brand fb-text-on-brand fb-absolute fb-right-8 fb-top-10 fb-space-y-2 fb-rounded-md fb-p-2 fb-text-xs",
        ref: languageDropdownRef,
        children: surveyLanguages.map((surveyLanguage) => {
          if (!surveyLanguage.enabled) return;
          return /* @__PURE__ */ u$1(
            "button",
            {
              type: "button",
              className: "fb-block fb-w-full fb-p-1.5 fb-text-left hover:fb-opacity-80",
              onClick: () => changeLanguage(surveyLanguage.language.code),
              children: getLanguageLabel(surveyLanguage.language.code)
            },
            surveyLanguage.language.id
          );
        })
      }
    )
  ] });
};
const Progress = ({ progress }) => {
  return /* @__PURE__ */ u$1("div", { className: "fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full", children: /* @__PURE__ */ u$1(
    "div",
    {
      className: "fb-transition-width fb-bg-brand fb-z-20 fb-h-2 fb-rounded-full fb-duration-500",
      style: { width: `${Math.floor(progress * 100)}%` }
    }
  ) });
};
const ProgressBar = ({ survey, questionId }) => {
  const currentQuestionIdx = T$1(
    () => survey.questions.findIndex((q2) => q2.id === questionId),
    [survey, questionId]
  );
  const endingCardIds = T$1(() => survey.endings.map((ending) => ending.id), [survey.endings]);
  const calculateProgress = q(
    (index, questionsLength) => {
      if (questionsLength === 0) return 0;
      if (index === -1) index = 0;
      const elementIdx = calculateElementIdx(survey, index);
      return elementIdx / questionsLength;
    },
    [survey]
  );
  const progressArray = T$1(() => {
    return survey.questions.map((_2, index) => calculateProgress(index, survey.questions.length));
  }, [calculateProgress, survey]);
  const progressValue = T$1(() => {
    if (questionId === "start") {
      return 0;
    } else if (endingCardIds.includes(questionId)) {
      return 1;
    } else {
      return progressArray[currentQuestionIdx];
    }
  }, [questionId, endingCardIds, progressArray, currentQuestionIdx]);
  return /* @__PURE__ */ u$1(Progress, { progress: progressValue });
};
const BackButton = ({ onClick, backButtonLabel, tabIndex = 2 }) => {
  return /* @__PURE__ */ u$1(
    "button",
    {
      dir: "auto",
      tabIndex,
      type: "button",
      className: cn(
        "fb-border-back-button-border fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
      ),
      onClick,
      children: backButtonLabel || "Back"
    }
  );
};
const Input$1 = ({ className: className2, ...props }) => {
  return /* @__PURE__ */ u$1(
    "input",
    {
      ...props,
      className: cn(
        "focus:fb-border-brand fb-bg-input-bg fb-flex fb-w-full fb-border fb-border-border fb-rounded-custom fb-px-3 fb-py-2 fb-text-sm fb-text-subheading placeholder:fb-text-placeholder focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50 dark:fb-border-slate-500 dark:fb-text-slate-300",
        className2 ?? ""
      ),
      dir: "auto"
    }
  );
};
const getUpdatedTtc = (ttc, questionId, time) => {
  if (ttc.hasOwnProperty(questionId)) {
    return {
      ...ttc,
      [questionId]: ttc[questionId] + time
    };
  } else {
    return {
      ...ttc,
      [questionId]: time
    };
  }
};
const useTtc = (questionId, ttc, setTtc, startTime, setStartTime, isCurrentQuestion) => {
  y(() => {
    if (!isCurrentQuestion) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setStartTime(performance.now());
      } else {
        const updatedTtc = getUpdatedTtc(ttc, questionId, performance.now() - startTime);
        setTtc(updatedTtc);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [questionId, setStartTime, setTtc, startTime, ttc, isCurrentQuestion]);
  y(() => {
    if (isCurrentQuestion) {
      setStartTime(performance.now());
    }
  }, [questionId, setStartTime, isCurrentQuestion]);
};
const AddressQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = A$1(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const safeValue = T$1(() => {
    return Array.isArray(value) ? value : ["", "", "", "", "", ""];
  }, [value]);
  const fields = [
    {
      id: "addressLine1",
      placeholder: "Address Line 1",
      ...question.addressLine1
    },
    {
      id: "addressLine2",
      placeholder: "Address Line 2",
      ...question.addressLine2
    },
    {
      id: "city",
      placeholder: "City",
      ...question.city
    },
    {
      id: "state",
      placeholder: "State",
      ...question.state
    },
    {
      id: "zip",
      placeholder: "Zip",
      ...question.zip
    },
    {
      id: "country",
      placeholder: "Country",
      ...question.country
    }
  ];
  const handleChange = (fieldId, fieldValue) => {
    const newValue = fields.map((field) => {
      if (field.id === fieldId) {
        return fieldValue;
      }
      const existingValue = (safeValue == null ? void 0 : safeValue[fields.findIndex((f2) => f2.id === field.id)]) || "";
      return field.show ? existingValue : "";
    });
    onChange({ [question.id]: newValue });
  };
  const handleSubmit = (e2) => {
    e2.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    const containsAllEmptyStrings = (safeValue == null ? void 0 : safeValue.length) === 6 && safeValue.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: safeValue ?? [] }, updatedTtc);
    }
  };
  return /* @__PURE__ */ u$1("form", { onSubmit: handleSubmit, className: "fb-w-full", ref: formRef, children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: getLocalizedValue(question.headline, languageCode),
          questionId: question.id,
          required: question.required
        }
      ),
      /* @__PURE__ */ u$1(
        Subheader,
        {
          subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
          questionId: question.id
        }
      ),
      /* @__PURE__ */ u$1("div", { className: `fb-flex fb-flex-col fb-space-y-2 fb-mt-4 fb-w-full`, children: fields.map((field, index) => {
        const isFieldRequired = () => {
          if (field.required) {
            return true;
          }
          if (fields.filter((field2) => field2.show).every((field2) => !field2.required) && question.required) {
            return true;
          }
          return false;
        };
        return field.show && /* @__PURE__ */ u$1(
          Input$1,
          {
            placeholder: isFieldRequired() ? `${field.placeholder}*` : field.placeholder,
            required: isFieldRequired(),
            value: (safeValue == null ? void 0 : safeValue[index]) || "",
            className: "fb-py-3",
            type: field.id === "email" ? "email" : "text",
            onChange: (e2) => {
              var _a2;
              return handleChange(field.id, ((_a2 = e2 == null ? void 0 : e2.currentTarget) == null ? void 0 : _a2.value) ?? "");
            }
          },
          field.id
        );
      }) })
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
      !isFirstQuestion && /* @__PURE__ */ u$1(
        BackButton,
        {
          tabIndex: 8,
          backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
          onClick: () => {
            const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
            setTtc(updatedttc);
            onBack();
          }
        }
      ),
      /* @__PURE__ */ u$1("div", {}),
      /* @__PURE__ */ u$1(
        SubmitButton,
        {
          tabIndex: 7,
          buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
          isLastQuestion,
          onClick: () => {
          }
        }
      )
    ] })
  ] }, question.id);
};
const HtmlBody = ({ htmlString, questionId }) => {
  const [safeHtml, setSafeHtml] = h("");
  y(() => {
    if (htmlString) {
      Promise.resolve().then(() => browser$2).then((DOMPurify) => {
        setSafeHtml(DOMPurify.sanitize(htmlString, { ADD_ATTR: ["target"] }));
      });
    }
  }, [htmlString]);
  if (!htmlString) return null;
  if (safeHtml === `<p class="fb-editor-paragraph"><br></p>`) return null;
  return /* @__PURE__ */ u$1(
    "label",
    {
      htmlFor: questionId,
      className: cn("fb-htmlbody fb-break-words"),
      dangerouslySetInnerHTML: { __html: safeHtml },
      dir: "auto"
    }
  );
};
const CTAQuestion = ({
  question,
  onSubmit,
  onChange,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  return /* @__PURE__ */ u$1("div", { children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: getLocalizedValue(question.headline, languageCode),
          questionId: question.id,
          required: question.required
        }
      ),
      /* @__PURE__ */ u$1(HtmlBody, { htmlString: getLocalizedValue(question.html, languageCode), questionId: question.id })
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
      !isFirstQuestion && /* @__PURE__ */ u$1(
        BackButton,
        {
          backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
          onClick: () => {
            const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
            setTtc(updatedTtcObj);
            onSubmit({ [question.id]: "" }, updatedTtcObj);
            onBack();
          }
        }
      ),
      /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-end", children: [
        !question.required && /* @__PURE__ */ u$1(
          "button",
          {
            dir: "auto",
            tabIndex: 0,
            type: "button",
            onClick: () => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "" }, updatedTtcObj);
              onChange({ [question.id]: "" });
            },
            className: "fb-text-heading focus:fb-ring-focus fb-mr-4 fb-flex fb-items-center fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2",
            children: getLocalizedValue(question.dismissButtonLabel, languageCode) || "Skip"
          }
        ),
        /* @__PURE__ */ u$1(
          SubmitButton,
          {
            buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
            isLastQuestion,
            focus: autoFocusEnabled,
            onClick: () => {
              var _a2;
              if (question.buttonExternal && question.buttonUrl) {
                (_a2 = window == null ? void 0 : window.open(question.buttonUrl, "_blank")) == null ? void 0 : _a2.focus();
              }
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: "clicked" }, updatedTtcObj);
              onChange({ [question.id]: "clicked" });
            },
            type: "button"
          }
        )
      ] })
    ] })
  ] }, question.id);
};
const l = "https://app.cal.com/embed/embed.js";
function r$1(o2 = l) {
  (function(i2, p2, d2) {
    let t2 = function(e2, n2) {
      e2.q.push(n2);
    }, c2 = i2.document;
    i2.Cal = i2.Cal || function() {
      let e2 = i2.Cal, n2 = arguments;
      if (e2.loaded || (e2.ns = {}, e2.q = e2.q || [], c2.head.appendChild(c2.createElement("script")).src = p2, e2.loaded = true), n2[0] === d2) {
        const s2 = function() {
          t2(s2, arguments);
        }, a2 = n2[1];
        s2.q = s2.q || [], typeof a2 == "string" ? (e2.ns[a2] = e2.ns[a2] || s2, t2(e2.ns[a2], n2), t2(e2, ["initNamespace", a2])) : t2(e2, n2);
        return;
      }
      t2(e2, n2);
    };
  })(
    window,
    //! Replace it with "https://cal.com/embed.js" or the URL where you have embed.js installed
    o2,
    "init"
  );
  /*!  Copying ends here. */
  return window.Cal;
}
r$1.toString();
const CalEmbed = ({ question, onSuccessfulBooking }) => {
  const cal = T$1(() => {
    const calInline = r$1("https://cal.com/embed.js");
    const calCssVars = {
      "cal-border-subtle": "transparent",
      "cal-border-booker": "transparent"
    };
    calInline("ui", {
      theme: "light",
      cssVarsPerTheme: {
        light: {
          ...calCssVars
        },
        dark: {
          "cal-bg-muted": "transparent",
          "cal-bg": "transparent",
          ...calCssVars
        }
      }
    });
    calInline("on", {
      action: "bookingSuccessful",
      callback: () => {
        onSuccessfulBooking();
      }
    });
    return calInline;
  }, [onSuccessfulBooking]);
  y(() => {
    document.querySelectorAll("cal-inline").forEach((el) => el.remove());
    cal("init", { calOrigin: question.calHost ? `https://${question.calHost}` : "https://cal.com" });
    cal("inline", {
      elementOrSelector: "#fb-cal-embed",
      calLink: question.calUserName
    });
  }, [cal, question.calHost, question.calUserName]);
  return /* @__PURE__ */ u$1("div", { className: "fb-relative fb-mt-4 fb-overflow-auto", children: /* @__PURE__ */ u$1("div", { id: "fb-cal-embed", className: cn("fb-border-border fb-rounded-lg fb-border") }) });
};
const CalQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const [errorMessage, setErrorMessage] = h("");
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const onSuccessfulBooking = q(() => {
    onChange({ [question.id]: "booked" });
    const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedttc);
    onSubmit({ [question.id]: "booked" }, updatedttc);
  }, [onChange, onSubmit, question.id, setTtc, startTime, ttc]);
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        if (question.required && !value) {
          setErrorMessage("Please book an appointment");
          return;
        }
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onChange({ [question.id]: value });
        onSubmit({ [question.id]: value }, updatedttc);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1(b, { children: [
            errorMessage && /* @__PURE__ */ u$1("span", { className: "fb-text-red-500", children: errorMessage }),
            /* @__PURE__ */ u$1(CalEmbed, { question, onSuccessfulBooking }, question.id)
          ] })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          !question.required && /* @__PURE__ */ u$1(
            SubmitButton,
            {
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const ConsentQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      },
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            HtmlBody,
            {
              htmlString: getLocalizedValue(question.html, languageCode) || "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-bg-survey-bg fb-sticky -fb-bottom-2 fb-z-10 fb-w-full fb-px-1 fb-py-1", children: /* @__PURE__ */ u$1(
            "label",
            {
              dir: "auto",
              tabIndex: 1,
              id: `${question.id}-label`,
              onKeyDown: (e2) => {
                var _a2, _b;
                if (e2.key === " ") {
                  e2.preventDefault();
                  (_a2 = document.getElementById(question.id)) == null ? void 0 : _a2.click();
                  (_b = document.getElementById(`${question.id}-label`)) == null ? void 0 : _b.focus();
                }
              },
              className: "fb-border-border fb-bg-input-bg fb-text-heading hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected focus:fb-ring-brand fb-rounded-custom fb-relative fb-z-10 fb-my-2 fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-border fb-p-4 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2",
              children: [
                /* @__PURE__ */ u$1(
                  "input",
                  {
                    type: "checkbox",
                    id: question.id,
                    name: question.id,
                    value: getLocalizedValue(question.label, languageCode),
                    onChange: (e2) => {
                      if (e2.target instanceof HTMLInputElement && e2.target.checked) {
                        onChange({ [question.id]: "accepted" });
                      } else {
                        onChange({ [question.id]: "" });
                      }
                    },
                    checked: value === "accepted",
                    className: "fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0",
                    "aria-labelledby": `${question.id}-label`,
                    required: question.required
                  }
                ),
                /* @__PURE__ */ u$1("span", { id: `${question.id}-label`, className: "fb-ml-3 fb-mr-3 fb-font-medium", children: getLocalizedValue(question.label, languageCode) })
              ]
            }
          ) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              tabIndex: 3,
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onSubmit({ [question.id]: value }, updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: 2,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const ContactInfoQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const formRef = A$1(null);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const safeValue = T$1(() => {
    return Array.isArray(value) ? value : ["", "", "", "", ""];
  }, [value]);
  const fields = [
    {
      id: "firstName",
      placeholder: "First Name",
      ...question.firstName
    },
    {
      id: "lastName",
      placeholder: "Last Name",
      ...question.lastName
    },
    {
      id: "email",
      placeholder: "Email",
      ...question.email
    },
    {
      id: "phone",
      placeholder: "Phone",
      ...question.phone
    },
    {
      id: "company",
      placeholder: "Company",
      ...question.company
    }
  ];
  const handleChange = (fieldId, fieldValue) => {
    const newValue = fields.map((field) => {
      if (field.id === fieldId) {
        return fieldValue;
      }
      const existingValue = (safeValue == null ? void 0 : safeValue[fields.findIndex((f2) => f2.id === field.id)]) || "";
      return field.show ? existingValue : "";
    });
    onChange({ [question.id]: newValue });
  };
  const handleSubmit = (e2) => {
    e2.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    const containsAllEmptyStrings = (safeValue == null ? void 0 : safeValue.length) === 5 && safeValue.every((item) => item.trim() === "");
    if (containsAllEmptyStrings) {
      onSubmit({ [question.id]: [] }, updatedTtc);
    } else {
      onSubmit({ [question.id]: safeValue ?? [] }, updatedTtc);
    }
  };
  return /* @__PURE__ */ u$1("form", { onSubmit: handleSubmit, className: "fb-w-full", ref: formRef, children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: getLocalizedValue(question.headline, languageCode),
          questionId: question.id,
          required: question.required
        }
      ),
      /* @__PURE__ */ u$1(
        Subheader,
        {
          subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
          questionId: question.id
        }
      ),
      /* @__PURE__ */ u$1("div", { className: `fb-flex fb-flex-col fb-space-y-2 fb-mt-4 fb-w-full`, children: fields.map((field, index) => {
        const isFieldRequired = () => {
          if (field.required) {
            return true;
          }
          if (fields.filter((field2) => field2.show).every((field2) => !field2.required) && question.required) {
            return true;
          }
          return false;
        };
        let inputType = "text";
        if (field.id === "email") {
          inputType = "email";
        } else if (field.id === "phone") {
          inputType = "number";
        }
        return field.show && /* @__PURE__ */ u$1(
          Input$1,
          {
            placeholder: isFieldRequired() ? `${field.placeholder}*` : field.placeholder,
            required: isFieldRequired(),
            value: (safeValue == null ? void 0 : safeValue[index]) || "",
            className: "fb-py-3",
            type: inputType,
            onChange: (e2) => {
              var _a2;
              return handleChange(field.id, ((_a2 = e2 == null ? void 0 : e2.currentTarget) == null ? void 0 : _a2.value) ?? "");
            }
          },
          field.id
        );
      }) })
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
      !isFirstQuestion && /* @__PURE__ */ u$1(
        BackButton,
        {
          tabIndex: 8,
          backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
          onClick: () => {
            const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
            setTtc(updatedttc);
            onBack();
          }
        }
      ),
      /* @__PURE__ */ u$1("div", {}),
      /* @__PURE__ */ u$1(
        SubmitButton,
        {
          tabIndex: 7,
          buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
          isLastQuestion,
          onClick: () => {
          }
        }
      )
    ] })
  ] }, question.id);
};
var __spreadArray$3 = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
    if (ar || !(i2 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
      ar[i2] = from[i2];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
var clipboardEvents = ["onCopy", "onCut", "onPaste"];
var compositionEvents = [
  "onCompositionEnd",
  "onCompositionStart",
  "onCompositionUpdate"
];
var focusEvents = ["onFocus", "onBlur"];
var formEvents = ["onInput", "onInvalid", "onReset", "onSubmit"];
var imageEvents = ["onLoad", "onError"];
var keyboardEvents = ["onKeyDown", "onKeyPress", "onKeyUp"];
var mediaEvents = [
  "onAbort",
  "onCanPlay",
  "onCanPlayThrough",
  "onDurationChange",
  "onEmptied",
  "onEncrypted",
  "onEnded",
  "onError",
  "onLoadedData",
  "onLoadedMetadata",
  "onLoadStart",
  "onPause",
  "onPlay",
  "onPlaying",
  "onProgress",
  "onRateChange",
  "onSeeked",
  "onSeeking",
  "onStalled",
  "onSuspend",
  "onTimeUpdate",
  "onVolumeChange",
  "onWaiting"
];
var mouseEvents = [
  "onClick",
  "onContextMenu",
  "onDoubleClick",
  "onMouseDown",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseMove",
  "onMouseOut",
  "onMouseOver",
  "onMouseUp"
];
var dragEvents = [
  "onDrag",
  "onDragEnd",
  "onDragEnter",
  "onDragExit",
  "onDragLeave",
  "onDragOver",
  "onDragStart",
  "onDrop"
];
var selectionEvents = ["onSelect"];
var touchEvents = ["onTouchCancel", "onTouchEnd", "onTouchMove", "onTouchStart"];
var pointerEvents = [
  "onPointerDown",
  "onPointerMove",
  "onPointerUp",
  "onPointerCancel",
  "onGotPointerCapture",
  "onLostPointerCapture",
  "onPointerEnter",
  "onPointerLeave",
  "onPointerOver",
  "onPointerOut"
];
var uiEvents = ["onScroll"];
var wheelEvents = ["onWheel"];
var animationEvents = [
  "onAnimationStart",
  "onAnimationEnd",
  "onAnimationIteration"
];
var transitionEvents = ["onTransitionEnd"];
var otherEvents = ["onToggle"];
var changeEvents = ["onChange"];
var allEvents = __spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3(__spreadArray$3([], clipboardEvents, true), compositionEvents, true), focusEvents, true), formEvents, true), imageEvents, true), keyboardEvents, true), mediaEvents, true), mouseEvents, true), dragEvents, true), selectionEvents, true), touchEvents, true), pointerEvents, true), uiEvents, true), wheelEvents, true), animationEvents, true), transitionEvents, true), changeEvents, true), otherEvents, true);
function makeEventProps(props, getArgs) {
  var eventProps = {};
  allEvents.forEach(function(eventName) {
    var eventHandler = props[eventName];
    if (!eventHandler) {
      return;
    }
    {
      eventProps[eventName] = eventHandler;
    }
  });
  return eventProps;
}
function r(e2) {
  var t2, f2, n2 = "";
  if ("string" == typeof e2 || "number" == typeof e2) n2 += e2;
  else if ("object" == typeof e2) if (Array.isArray(e2)) {
    var o2 = e2.length;
    for (t2 = 0; t2 < o2; t2++) e2[t2] && (f2 = r(e2[t2])) && (n2 && (n2 += " "), n2 += f2);
  } else for (f2 in e2) e2[f2] && (n2 && (n2 += " "), n2 += f2);
  return n2;
}
function clsx() {
  for (var e2, t2, f2 = 0, n2 = "", o2 = arguments.length; f2 < o2; f2++) (e2 = arguments[f2]) && (t2 = r(e2)) && (n2 && (n2 += " "), n2 += t2);
  return n2;
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
const copyProperty = (to, from, property, ignoreNonConfigurable) => {
  if (property === "length" || property === "prototype") {
    return;
  }
  if (property === "arguments" || property === "caller") {
    return;
  }
  const toDescriptor = Object.getOwnPropertyDescriptor(to, property);
  const fromDescriptor = Object.getOwnPropertyDescriptor(from, property);
  if (!canCopyProperty(toDescriptor, fromDescriptor) && ignoreNonConfigurable) {
    return;
  }
  Object.defineProperty(to, property, fromDescriptor);
};
const canCopyProperty = function(toDescriptor, fromDescriptor) {
  return toDescriptor === void 0 || toDescriptor.configurable || toDescriptor.writable === fromDescriptor.writable && toDescriptor.enumerable === fromDescriptor.enumerable && toDescriptor.configurable === fromDescriptor.configurable && (toDescriptor.writable || toDescriptor.value === fromDescriptor.value);
};
const changePrototype = (to, from) => {
  const fromPrototype = Object.getPrototypeOf(from);
  if (fromPrototype === Object.getPrototypeOf(to)) {
    return;
  }
  Object.setPrototypeOf(to, fromPrototype);
};
const wrappedToString = (withName, fromBody) => `/* Wrapped ${withName}*/
${fromBody}`;
const toStringDescriptor = Object.getOwnPropertyDescriptor(Function.prototype, "toString");
const toStringName = Object.getOwnPropertyDescriptor(Function.prototype.toString, "name");
const changeToString = (to, from, name) => {
  const withName = name === "" ? "" : `with ${name.trim()}() `;
  const newToString = wrappedToString.bind(null, withName, from.toString());
  Object.defineProperty(newToString, "name", toStringName);
  Object.defineProperty(to, "toString", { ...toStringDescriptor, value: newToString });
};
const mimicFn$1 = (to, from, { ignoreNonConfigurable = false } = {}) => {
  const { name } = to;
  for (const property of Reflect.ownKeys(from)) {
    copyProperty(to, from, property, ignoreNonConfigurable);
  }
  changePrototype(to, from);
  changeToString(to, from, name);
  return to;
};
var mimicFn_1 = mimicFn$1;
var dist$1 = { exports: {} };
var pDefer = () => {
  const ret = {};
  ret.promise = new Promise((resolve, reject) => {
    ret.resolve = resolve;
    ret.reject = reject;
  });
  return ret;
};
(function(module, exports) {
  var __awaiter = commonjsGlobal && commonjsGlobal.__awaiter || function(thisArg, _arguments, P2, generator) {
    return new (P2 || (P2 = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e2) {
          reject(e2);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e2) {
          reject(e2);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : new P2(function(resolve2) {
          resolve2(result.value);
        }).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
  var __importDefault = commonjsGlobal && commonjsGlobal.__importDefault || function(mod) {
    return mod && mod.__esModule ? mod : { "default": mod };
  };
  Object.defineProperty(exports, "__esModule", { value: true });
  const p_defer_1 = __importDefault(pDefer);
  function mapAgeCleaner2(map, property = "maxAge") {
    let processingKey;
    let processingTimer;
    let processingDeferred;
    const cleanup = () => __awaiter(this, void 0, void 0, function* () {
      if (processingKey !== void 0) {
        return;
      }
      const setupTimer = (item) => __awaiter(this, void 0, void 0, function* () {
        processingDeferred = p_defer_1.default();
        const delay = item[1][property] - Date.now();
        if (delay <= 0) {
          map.delete(item[0]);
          processingDeferred.resolve();
          return;
        }
        processingKey = item[0];
        processingTimer = setTimeout(() => {
          map.delete(item[0]);
          if (processingDeferred) {
            processingDeferred.resolve();
          }
        }, delay);
        if (typeof processingTimer.unref === "function") {
          processingTimer.unref();
        }
        return processingDeferred.promise;
      });
      try {
        for (const entry of map) {
          yield setupTimer(entry);
        }
      } catch (_a2) {
      }
      processingKey = void 0;
    });
    const reset = () => {
      processingKey = void 0;
      if (processingTimer !== void 0) {
        clearTimeout(processingTimer);
        processingTimer = void 0;
      }
      if (processingDeferred !== void 0) {
        processingDeferred.reject(void 0);
        processingDeferred = void 0;
      }
    };
    const originalSet = map.set.bind(map);
    map.set = (key, value) => {
      if (map.has(key)) {
        map.delete(key);
      }
      const result = originalSet(key, value);
      if (processingKey && processingKey === key) {
        reset();
      }
      cleanup();
      return result;
    };
    cleanup();
    return map;
  }
  exports.default = mapAgeCleaner2;
  module.exports = mapAgeCleaner2;
  module.exports.default = mapAgeCleaner2;
})(dist$1, dist$1.exports);
var distExports = dist$1.exports;
const mimicFn = mimicFn_1;
const mapAgeCleaner = distExports;
const decoratorInstanceMap = /* @__PURE__ */ new WeakMap();
const cacheStore = /* @__PURE__ */ new WeakMap();
const mem = (fn2, { cacheKey, cache = /* @__PURE__ */ new Map(), maxAge } = {}) => {
  if (typeof maxAge === "number") {
    mapAgeCleaner(cache);
  }
  const memoized = function(...arguments_) {
    const key = cacheKey ? cacheKey(arguments_) : arguments_[0];
    const cacheItem = cache.get(key);
    if (cacheItem) {
      return cacheItem.data;
    }
    const result = fn2.apply(this, arguments_);
    cache.set(key, {
      data: result,
      maxAge: maxAge ? Date.now() + maxAge : Number.POSITIVE_INFINITY
    });
    return result;
  };
  mimicFn(memoized, fn2, {
    ignoreNonConfigurable: true
  });
  cacheStore.set(memoized, cache);
  return memoized;
};
mem.decorator = (options2 = {}) => (target2, propertyKey, descriptor) => {
  const input = target2[propertyKey];
  if (typeof input !== "function") {
    throw new TypeError("The decorated value must be a function");
  }
  delete descriptor.value;
  delete descriptor.writable;
  descriptor.get = function() {
    if (!decoratorInstanceMap.has(this)) {
      const value = mem(input, options2);
      decoratorInstanceMap.set(this, value);
      return value;
    }
    return decoratorInstanceMap.get(this);
  };
};
mem.clear = (fn2) => {
  const cache = cacheStore.get(fn2);
  if (!cache) {
    throw new TypeError("Can't clear a function that was not memoized!");
  }
  if (typeof cache.clear !== "function") {
    throw new TypeError("The cache Map can't be cleared!");
  }
  cache.clear();
};
var dist = mem;
const mem$1 = /* @__PURE__ */ getDefaultExportFromCjs(dist);
function isString(el) {
  return typeof el === "string";
}
function isUnique(el, index, arr) {
  return arr.indexOf(el) === index;
}
function isAllLowerCase(el) {
  return el.toLowerCase() === el;
}
function fixCommas(el) {
  return el.indexOf(",") === -1 ? el : el.split(",");
}
function normalizeLocale(locale) {
  if (!locale) {
    return locale;
  }
  if (locale === "C" || locale === "posix" || locale === "POSIX") {
    return "en-US";
  }
  if (locale.indexOf(".") !== -1) {
    var _a2 = locale.split(".")[0], actualLocale = _a2 === void 0 ? "" : _a2;
    return normalizeLocale(actualLocale);
  }
  if (locale.indexOf("@") !== -1) {
    var _b = locale.split("@")[0], actualLocale = _b === void 0 ? "" : _b;
    return normalizeLocale(actualLocale);
  }
  if (locale.indexOf("-") === -1 || !isAllLowerCase(locale)) {
    return locale;
  }
  var _c = locale.split("-"), splitEl1 = _c[0], _d = _c[1], splitEl2 = _d === void 0 ? "" : _d;
  return "".concat(splitEl1, "-").concat(splitEl2.toUpperCase());
}
function getUserLocalesInternal(_a2) {
  var _b = _a2 === void 0 ? {} : _a2, _c = _b.useFallbackLocale, useFallbackLocale = _c === void 0 ? true : _c, _d = _b.fallbackLocale, fallbackLocale = _d === void 0 ? "en-US" : _d;
  var languageList = [];
  if (typeof navigator !== "undefined") {
    var rawLanguages = navigator.languages || [];
    var languages = [];
    for (var _i = 0, rawLanguages_1 = rawLanguages; _i < rawLanguages_1.length; _i++) {
      var rawLanguagesItem = rawLanguages_1[_i];
      languages = languages.concat(fixCommas(rawLanguagesItem));
    }
    var rawLanguage = navigator.language;
    var language = rawLanguage ? fixCommas(rawLanguage) : rawLanguage;
    languageList = languageList.concat(languages, language);
  }
  if (useFallbackLocale) {
    languageList.push(fallbackLocale);
  }
  return languageList.filter(isString).map(normalizeLocale).filter(isUnique);
}
var getUserLocales = mem$1(getUserLocalesInternal, { cacheKey: JSON.stringify });
function getUserLocaleInternal(options2) {
  return getUserLocales(options2)[0] || null;
}
var getUserLocale = mem$1(getUserLocaleInternal, { cacheKey: JSON.stringify });
function makeGetEdgeOfNeighbor(getPeriod, getEdgeOfPeriod, defaultOffset) {
  return function makeGetEdgeOfNeighborInternal(date, offset) {
    if (offset === void 0) {
      offset = defaultOffset;
    }
    var previousPeriod = getPeriod(date) + offset;
    return getEdgeOfPeriod(previousPeriod);
  };
}
function makeGetEnd(getBeginOfNextPeriod) {
  return function makeGetEndInternal(date) {
    return new Date(getBeginOfNextPeriod(date).getTime() - 1);
  };
}
function makeGetRange(getStart, getEnd2) {
  return function makeGetRangeInternal(date) {
    return [getStart(date), getEnd2(date)];
  };
}
function getYear(date) {
  if (date instanceof Date) {
    return date.getFullYear();
  }
  if (typeof date === "number") {
    return date;
  }
  var year = parseInt(date, 10);
  if (typeof date === "string" && !isNaN(year)) {
    return year;
  }
  throw new Error("Failed to get year from date: ".concat(date, "."));
}
function getMonth(date) {
  if (date instanceof Date) {
    return date.getMonth();
  }
  throw new Error("Failed to get month from date: ".concat(date, "."));
}
function getMonthHuman(date) {
  if (date instanceof Date) {
    return date.getMonth() + 1;
  }
  throw new Error("Failed to get human-readable month from date: ".concat(date, "."));
}
function getDate(date) {
  if (date instanceof Date) {
    return date.getDate();
  }
  throw new Error("Failed to get year from date: ".concat(date, "."));
}
function getCenturyStart(date) {
  var year = getYear(date);
  var centuryStartYear = year + (-year + 1) % 100;
  var centuryStartDate = /* @__PURE__ */ new Date();
  centuryStartDate.setFullYear(centuryStartYear, 0, 1);
  centuryStartDate.setHours(0, 0, 0, 0);
  return centuryStartDate;
}
var getPreviousCenturyStart = makeGetEdgeOfNeighbor(getYear, getCenturyStart, -100);
var getNextCenturyStart = makeGetEdgeOfNeighbor(getYear, getCenturyStart, 100);
var getCenturyEnd = makeGetEnd(getNextCenturyStart);
var getPreviousCenturyEnd = makeGetEdgeOfNeighbor(getYear, getCenturyEnd, -100);
var getCenturyRange = makeGetRange(getCenturyStart, getCenturyEnd);
function getDecadeStart(date) {
  var year = getYear(date);
  var decadeStartYear = year + (-year + 1) % 10;
  var decadeStartDate = /* @__PURE__ */ new Date();
  decadeStartDate.setFullYear(decadeStartYear, 0, 1);
  decadeStartDate.setHours(0, 0, 0, 0);
  return decadeStartDate;
}
var getPreviousDecadeStart = makeGetEdgeOfNeighbor(getYear, getDecadeStart, -10);
var getNextDecadeStart = makeGetEdgeOfNeighbor(getYear, getDecadeStart, 10);
var getDecadeEnd = makeGetEnd(getNextDecadeStart);
var getPreviousDecadeEnd = makeGetEdgeOfNeighbor(getYear, getDecadeEnd, -10);
var getDecadeRange = makeGetRange(getDecadeStart, getDecadeEnd);
function getYearStart(date) {
  var year = getYear(date);
  var yearStartDate = /* @__PURE__ */ new Date();
  yearStartDate.setFullYear(year, 0, 1);
  yearStartDate.setHours(0, 0, 0, 0);
  return yearStartDate;
}
var getPreviousYearStart = makeGetEdgeOfNeighbor(getYear, getYearStart, -1);
var getNextYearStart = makeGetEdgeOfNeighbor(getYear, getYearStart, 1);
var getYearEnd = makeGetEnd(getNextYearStart);
var getPreviousYearEnd = makeGetEdgeOfNeighbor(getYear, getYearEnd, -1);
var getYearRange = makeGetRange(getYearStart, getYearEnd);
function makeGetEdgeOfNeighborMonth(getEdgeOfPeriod, defaultOffset) {
  return function makeGetEdgeOfNeighborMonthInternal(date, offset) {
    if (offset === void 0) {
      offset = defaultOffset;
    }
    var year = getYear(date);
    var month = getMonth(date) + offset;
    var previousPeriod = /* @__PURE__ */ new Date();
    previousPeriod.setFullYear(year, month, 1);
    previousPeriod.setHours(0, 0, 0, 0);
    return getEdgeOfPeriod(previousPeriod);
  };
}
function getMonthStart(date) {
  var year = getYear(date);
  var month = getMonth(date);
  var monthStartDate = /* @__PURE__ */ new Date();
  monthStartDate.setFullYear(year, month, 1);
  monthStartDate.setHours(0, 0, 0, 0);
  return monthStartDate;
}
var getPreviousMonthStart = makeGetEdgeOfNeighborMonth(getMonthStart, -1);
var getNextMonthStart = makeGetEdgeOfNeighborMonth(getMonthStart, 1);
var getMonthEnd = makeGetEnd(getNextMonthStart);
var getPreviousMonthEnd = makeGetEdgeOfNeighborMonth(getMonthEnd, -1);
var getMonthRange = makeGetRange(getMonthStart, getMonthEnd);
function makeGetEdgeOfNeighborDay(getEdgeOfPeriod, defaultOffset) {
  return function makeGetEdgeOfNeighborDayInternal(date, offset) {
    if (offset === void 0) {
      offset = defaultOffset;
    }
    var year = getYear(date);
    var month = getMonth(date);
    var day = getDate(date) + offset;
    var previousPeriod = /* @__PURE__ */ new Date();
    previousPeriod.setFullYear(year, month, day);
    previousPeriod.setHours(0, 0, 0, 0);
    return getEdgeOfPeriod(previousPeriod);
  };
}
function getDayStart(date) {
  var year = getYear(date);
  var month = getMonth(date);
  var day = getDate(date);
  var dayStartDate = /* @__PURE__ */ new Date();
  dayStartDate.setFullYear(year, month, day);
  dayStartDate.setHours(0, 0, 0, 0);
  return dayStartDate;
}
var getNextDayStart = makeGetEdgeOfNeighborDay(getDayStart, 1);
var getDayEnd = makeGetEnd(getNextDayStart);
var getDayRange = makeGetRange(getDayStart, getDayEnd);
function getDaysInMonth(date) {
  return getDate(getMonthEnd(date));
}
function padStart(num, val) {
  if (val === void 0) {
    val = 2;
  }
  var numStr = "".concat(num);
  if (numStr.length >= val) {
    return num;
  }
  return "0000".concat(numStr).slice(-val);
}
function getISOLocalMonth(date) {
  var year = padStart(getYear(date), 4);
  var month = padStart(getMonthHuman(date));
  return "".concat(year, "-").concat(month);
}
function getISOLocalDate(date) {
  var year = padStart(getYear(date), 4);
  var month = padStart(getMonthHuman(date));
  var day = padStart(getDate(date));
  return "".concat(year, "-").concat(month, "-").concat(day);
}
var _a;
var CALENDAR_TYPES = {
  GREGORY: "gregory",
  HEBREW: "hebrew",
  ISLAMIC: "islamic",
  ISO_8601: "iso8601"
};
var CALENDAR_TYPE_LOCALES = (_a = {}, _a[CALENDAR_TYPES.GREGORY] = [
  "en-CA",
  "en-US",
  "es-AR",
  "es-BO",
  "es-CL",
  "es-CO",
  "es-CR",
  "es-DO",
  "es-EC",
  "es-GT",
  "es-HN",
  "es-MX",
  "es-NI",
  "es-PA",
  "es-PE",
  "es-PR",
  "es-SV",
  "es-VE",
  "pt-BR"
], _a[CALENDAR_TYPES.HEBREW] = ["he", "he-IL"], _a[CALENDAR_TYPES.ISLAMIC] = [
  // ar-LB, ar-MA intentionally missing
  "ar",
  "ar-AE",
  "ar-BH",
  "ar-DZ",
  "ar-EG",
  "ar-IQ",
  "ar-JO",
  "ar-KW",
  "ar-LY",
  "ar-OM",
  "ar-QA",
  "ar-SA",
  "ar-SD",
  "ar-SY",
  "ar-YE",
  "dv",
  "dv-MV",
  "ps",
  "ps-AR"
], _a);
var WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
var formatterCache$1 = /* @__PURE__ */ new Map();
function getFormatter$1(options2) {
  return function formatter(locale, date) {
    var localeWithDefault = locale || getUserLocale();
    if (!formatterCache$1.has(localeWithDefault)) {
      formatterCache$1.set(localeWithDefault, /* @__PURE__ */ new Map());
    }
    var formatterCacheLocale = formatterCache$1.get(localeWithDefault);
    if (!formatterCacheLocale.has(options2)) {
      formatterCacheLocale.set(options2, new Intl.DateTimeFormat(localeWithDefault || void 0, options2).format);
    }
    return formatterCacheLocale.get(options2)(date);
  };
}
function toSafeHour$1(date) {
  var safeDate = new Date(date);
  return new Date(safeDate.setHours(12));
}
function getSafeFormatter$1(options2) {
  return function(locale, date) {
    return getFormatter$1(options2)(locale, toSafeHour$1(date));
  };
}
var formatDayOptions = { day: "numeric" };
var formatLongDateOptions = {
  day: "numeric",
  month: "long",
  year: "numeric"
};
var formatMonthOptions$1 = { month: "long" };
var formatMonthYearOptions = {
  month: "long",
  year: "numeric"
};
var formatShortWeekdayOptions = { weekday: "short" };
var formatWeekdayOptions = { weekday: "long" };
var formatYearOptions = { year: "numeric" };
var formatDay = getSafeFormatter$1(formatDayOptions);
var formatLongDate = getSafeFormatter$1(formatLongDateOptions);
var formatMonth$1 = getSafeFormatter$1(formatMonthOptions$1);
var formatMonthYear = getSafeFormatter$1(formatMonthYearOptions);
var formatShortWeekday = getSafeFormatter$1(formatShortWeekdayOptions);
var formatWeekday = getSafeFormatter$1(formatWeekdayOptions);
var formatYear = getSafeFormatter$1(formatYearOptions);
var SUNDAY = WEEKDAYS[0];
var FRIDAY = WEEKDAYS[5];
var SATURDAY = WEEKDAYS[6];
function getDayOfWeek(date, calendarType) {
  if (calendarType === void 0) {
    calendarType = CALENDAR_TYPES.ISO_8601;
  }
  var weekday = date.getDay();
  switch (calendarType) {
    case CALENDAR_TYPES.ISO_8601:
      return (weekday + 6) % 7;
    case CALENDAR_TYPES.ISLAMIC:
      return (weekday + 1) % 7;
    case CALENDAR_TYPES.HEBREW:
    case CALENDAR_TYPES.GREGORY:
      return weekday;
    default:
      throw new Error("Unsupported calendar type.");
  }
}
function getBeginOfCenturyYear(date) {
  var beginOfCentury = getCenturyStart(date);
  return getYear(beginOfCentury);
}
function getBeginOfDecadeYear(date) {
  var beginOfDecade = getDecadeStart(date);
  return getYear(beginOfDecade);
}
function getBeginOfWeek(date, calendarType) {
  if (calendarType === void 0) {
    calendarType = CALENDAR_TYPES.ISO_8601;
  }
  var year = getYear(date);
  var monthIndex = getMonth(date);
  var day = date.getDate() - getDayOfWeek(date, calendarType);
  return new Date(year, monthIndex, day);
}
function getWeekNumber(date, calendarType) {
  if (calendarType === void 0) {
    calendarType = CALENDAR_TYPES.ISO_8601;
  }
  var calendarTypeForWeekNumber = calendarType === CALENDAR_TYPES.GREGORY ? CALENDAR_TYPES.GREGORY : CALENDAR_TYPES.ISO_8601;
  var beginOfWeek = getBeginOfWeek(date, calendarType);
  var year = getYear(date) + 1;
  var dayInWeekOne;
  var beginOfFirstWeek;
  do {
    dayInWeekOne = new Date(year, 0, calendarTypeForWeekNumber === CALENDAR_TYPES.ISO_8601 ? 4 : 1);
    beginOfFirstWeek = getBeginOfWeek(dayInWeekOne, calendarType);
    year -= 1;
  } while (date < beginOfFirstWeek);
  return Math.round((beginOfWeek.getTime() - beginOfFirstWeek.getTime()) / (864e5 * 7)) + 1;
}
function getBegin$1(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getCenturyStart(date);
    case "decade":
      return getDecadeStart(date);
    case "year":
      return getYearStart(date);
    case "month":
      return getMonthStart(date);
    case "day":
      return getDayStart(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getBeginPrevious(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getPreviousCenturyStart(date);
    case "decade":
      return getPreviousDecadeStart(date);
    case "year":
      return getPreviousYearStart(date);
    case "month":
      return getPreviousMonthStart(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getBeginNext(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getNextCenturyStart(date);
    case "decade":
      return getNextDecadeStart(date);
    case "year":
      return getNextYearStart(date);
    case "month":
      return getNextMonthStart(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getBeginPrevious2(rangeType, date) {
  switch (rangeType) {
    case "decade":
      return getPreviousDecadeStart(date, -100);
    case "year":
      return getPreviousYearStart(date, -10);
    case "month":
      return getPreviousMonthStart(date, -12);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getBeginNext2(rangeType, date) {
  switch (rangeType) {
    case "decade":
      return getNextDecadeStart(date, 100);
    case "year":
      return getNextYearStart(date, 10);
    case "month":
      return getNextMonthStart(date, 12);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getEnd$1(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getCenturyEnd(date);
    case "decade":
      return getDecadeEnd(date);
    case "year":
      return getYearEnd(date);
    case "month":
      return getMonthEnd(date);
    case "day":
      return getDayEnd(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getEndPrevious(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getPreviousCenturyEnd(date);
    case "decade":
      return getPreviousDecadeEnd(date);
    case "year":
      return getPreviousYearEnd(date);
    case "month":
      return getPreviousMonthEnd(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getEndPrevious2(rangeType, date) {
  switch (rangeType) {
    case "decade":
      return getPreviousDecadeEnd(date, -100);
    case "year":
      return getPreviousYearEnd(date, -10);
    case "month":
      return getPreviousMonthEnd(date, -12);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getRange(rangeType, date) {
  switch (rangeType) {
    case "century":
      return getCenturyRange(date);
    case "decade":
      return getDecadeRange(date);
    case "year":
      return getYearRange(date);
    case "month":
      return getMonthRange(date);
    case "day":
      return getDayRange(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getValueRange(rangeType, date1, date2) {
  var rawNextValue = [date1, date2].sort(function(a2, b2) {
    return a2.getTime() - b2.getTime();
  });
  return [getBegin$1(rangeType, rawNextValue[0]), getEnd$1(rangeType, rawNextValue[1])];
}
function toYearLabel(locale, formatYear$1, dates) {
  if (formatYear$1 === void 0) {
    formatYear$1 = formatYear;
  }
  return dates.map(function(date) {
    return formatYear$1(locale, date);
  }).join(" – ");
}
function getCenturyLabel(locale, formatYear2, date) {
  return toYearLabel(locale, formatYear2, getCenturyRange(date));
}
function getDecadeLabel(locale, formatYear2, date) {
  return toYearLabel(locale, formatYear2, getDecadeRange(date));
}
function isCurrentDayOfWeek(date) {
  return date.getDay() === (/* @__PURE__ */ new Date()).getDay();
}
function isWeekend(date, calendarType) {
  if (calendarType === void 0) {
    calendarType = CALENDAR_TYPES.ISO_8601;
  }
  var weekday = date.getDay();
  switch (calendarType) {
    case CALENDAR_TYPES.ISLAMIC:
    case CALENDAR_TYPES.HEBREW:
      return weekday === FRIDAY || weekday === SATURDAY;
    case CALENDAR_TYPES.ISO_8601:
    case CALENDAR_TYPES.GREGORY:
      return weekday === SATURDAY || weekday === SUNDAY;
    default:
      throw new Error("Unsupported calendar type.");
  }
}
var className$6 = "react-calendar__navigation";
function Navigation(_a2) {
  var activeStartDate = _a2.activeStartDate, drillUp = _a2.drillUp, _b = _a2.formatMonthYear, formatMonthYear$1 = _b === void 0 ? formatMonthYear : _b, _c = _a2.formatYear, formatYear$1 = _c === void 0 ? formatYear : _c, locale = _a2.locale, maxDate = _a2.maxDate, minDate = _a2.minDate, _d = _a2.navigationAriaLabel, navigationAriaLabel = _d === void 0 ? "" : _d, navigationAriaLive = _a2.navigationAriaLive, navigationLabel = _a2.navigationLabel, _e = _a2.next2AriaLabel, next2AriaLabel = _e === void 0 ? "" : _e, _f = _a2.next2Label, next2Label = _f === void 0 ? "»" : _f, _g = _a2.nextAriaLabel, nextAriaLabel = _g === void 0 ? "" : _g, _h = _a2.nextLabel, nextLabel = _h === void 0 ? "›" : _h, _j = _a2.prev2AriaLabel, prev2AriaLabel = _j === void 0 ? "" : _j, _k = _a2.prev2Label, prev2Label = _k === void 0 ? "«" : _k, _l = _a2.prevAriaLabel, prevAriaLabel = _l === void 0 ? "" : _l, _m = _a2.prevLabel, prevLabel = _m === void 0 ? "‹" : _m, setActiveStartDate = _a2.setActiveStartDate, showDoubleView = _a2.showDoubleView, view = _a2.view, views = _a2.views;
  var drillUpAvailable = views.indexOf(view) > 0;
  var shouldShowPrevNext2Buttons = view !== "century";
  var previousActiveStartDate = getBeginPrevious(view, activeStartDate);
  var previousActiveStartDate2 = shouldShowPrevNext2Buttons ? getBeginPrevious2(view, activeStartDate) : void 0;
  var nextActiveStartDate = getBeginNext(view, activeStartDate);
  var nextActiveStartDate2 = shouldShowPrevNext2Buttons ? getBeginNext2(view, activeStartDate) : void 0;
  var prevButtonDisabled = function() {
    if (previousActiveStartDate.getFullYear() < 0) {
      return true;
    }
    var previousActiveEndDate = getEndPrevious(view, activeStartDate);
    return minDate && minDate >= previousActiveEndDate;
  }();
  var prev2ButtonDisabled = shouldShowPrevNext2Buttons && function() {
    if (previousActiveStartDate2.getFullYear() < 0) {
      return true;
    }
    var previousActiveEndDate = getEndPrevious2(view, activeStartDate);
    return minDate && minDate >= previousActiveEndDate;
  }();
  var nextButtonDisabled = maxDate && maxDate < nextActiveStartDate;
  var next2ButtonDisabled = shouldShowPrevNext2Buttons && maxDate && maxDate < nextActiveStartDate2;
  function onClickPrevious() {
    setActiveStartDate(previousActiveStartDate, "prev");
  }
  function onClickPrevious2() {
    setActiveStartDate(previousActiveStartDate2, "prev2");
  }
  function onClickNext() {
    setActiveStartDate(nextActiveStartDate, "next");
  }
  function onClickNext2() {
    setActiveStartDate(nextActiveStartDate2, "next2");
  }
  function renderLabel(date) {
    var label = function() {
      switch (view) {
        case "century":
          return getCenturyLabel(locale, formatYear$1, date);
        case "decade":
          return getDecadeLabel(locale, formatYear$1, date);
        case "year":
          return formatYear$1(locale, date);
        case "month":
          return formatMonthYear$1(locale, date);
        default:
          throw new Error("Invalid view: ".concat(view, "."));
      }
    }();
    return navigationLabel ? navigationLabel({
      date,
      label,
      locale: locale || getUserLocale() || void 0,
      view
    }) : label;
  }
  function renderButton() {
    var labelClassName = "".concat(className$6, "__label");
    return u$1("button", { "aria-label": navigationAriaLabel, "aria-live": navigationAriaLive, className: labelClassName, disabled: !drillUpAvailable, onClick: drillUp, style: { flexGrow: 1 }, type: "button", children: [u$1("span", { className: "".concat(labelClassName, "__labelText ").concat(labelClassName, "__labelText--from"), children: renderLabel(activeStartDate) }), showDoubleView ? u$1(b, { children: [u$1("span", { className: "".concat(labelClassName, "__divider"), children: " – " }), u$1("span", { className: "".concat(labelClassName, "__labelText ").concat(labelClassName, "__labelText--to"), children: renderLabel(nextActiveStartDate) })] }) : null] });
  }
  return u$1("div", { className: className$6, children: [prev2Label !== null && shouldShowPrevNext2Buttons ? u$1("button", { "aria-label": prev2AriaLabel, className: "".concat(className$6, "__arrow ").concat(className$6, "__prev2-button"), disabled: prev2ButtonDisabled, onClick: onClickPrevious2, type: "button", children: prev2Label }) : null, prevLabel !== null && u$1("button", { "aria-label": prevAriaLabel, className: "".concat(className$6, "__arrow ").concat(className$6, "__prev-button"), disabled: prevButtonDisabled, onClick: onClickPrevious, type: "button", children: prevLabel }), renderButton(), nextLabel !== null && u$1("button", { "aria-label": nextAriaLabel, className: "".concat(className$6, "__arrow ").concat(className$6, "__next-button"), disabled: nextButtonDisabled, onClick: onClickNext, type: "button", children: nextLabel }), next2Label !== null && shouldShowPrevNext2Buttons ? u$1("button", { "aria-label": next2AriaLabel, className: "".concat(className$6, "__arrow ").concat(className$6, "__next2-button"), disabled: next2ButtonDisabled, onClick: onClickNext2, type: "button", children: next2Label }) : null] });
}
var __assign$k = function() {
  __assign$k = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$k.apply(this, arguments);
};
var __rest$f = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function toPercent(num) {
  return "".concat(num, "%");
}
function Flex(_a2) {
  var children = _a2.children, className2 = _a2.className, count = _a2.count, direction = _a2.direction, offset = _a2.offset, style = _a2.style, wrap = _a2.wrap, otherProps = __rest$f(_a2, ["children", "className", "count", "direction", "offset", "style", "wrap"]);
  return u$1("div", __assign$k({ className: className2, style: __assign$k({ display: "flex", flexDirection: direction, flexWrap: wrap ? "wrap" : "nowrap" }, style) }, otherProps, { children: N.map(children, function(child, index) {
    var marginInlineStart = offset && index === 0 ? toPercent(100 * offset / count) : null;
    return hn(child, __assign$k(__assign$k({}, child.props), { style: {
      flexBasis: toPercent(100 / count),
      flexShrink: 0,
      flexGrow: 0,
      overflow: "hidden",
      marginLeft: marginInlineStart,
      marginInlineStart,
      marginInlineEnd: 0
    } }));
  }) }));
}
function between$1(value, min, max) {
  if (min && min > value) {
    return min;
  }
  if (max && max < value) {
    return max;
  }
  return value;
}
function isValueWithinRange(value, range) {
  return range[0] <= value && range[1] >= value;
}
function isRangeWithinRange(greaterRange, smallerRange) {
  return greaterRange[0] <= smallerRange[0] && greaterRange[1] >= smallerRange[1];
}
function doRangesOverlap(range1, range2) {
  return isValueWithinRange(range1[0], range2) || isValueWithinRange(range1[1], range2);
}
function getRangeClassNames(valueRange, dateRange, baseClassName2) {
  var isRange = doRangesOverlap(dateRange, valueRange);
  var classes = [];
  if (isRange) {
    classes.push(baseClassName2);
    var isRangeStart = isValueWithinRange(valueRange[0], dateRange);
    var isRangeEnd = isValueWithinRange(valueRange[1], dateRange);
    if (isRangeStart) {
      classes.push("".concat(baseClassName2, "Start"));
    }
    if (isRangeEnd) {
      classes.push("".concat(baseClassName2, "End"));
    }
    if (isRangeStart && isRangeEnd) {
      classes.push("".concat(baseClassName2, "BothEnds"));
    }
  }
  return classes;
}
function isCompleteValue(value) {
  if (Array.isArray(value)) {
    return value[0] !== null && value[1] !== null;
  }
  return value !== null;
}
function getTileClasses(args) {
  if (!args) {
    throw new Error("args is required");
  }
  var value = args.value, date = args.date, hover = args.hover;
  var className2 = "react-calendar__tile";
  var classes = [className2];
  if (!date) {
    return classes;
  }
  var now = /* @__PURE__ */ new Date();
  var dateRange = function() {
    if (Array.isArray(date)) {
      return date;
    }
    var dateType2 = args.dateType;
    if (!dateType2) {
      throw new Error("dateType is required when date is not an array of two dates");
    }
    return getRange(dateType2, date);
  }();
  if (isValueWithinRange(now, dateRange)) {
    classes.push("".concat(className2, "--now"));
  }
  if (!value || !isCompleteValue(value)) {
    return classes;
  }
  var valueRange = function() {
    if (Array.isArray(value)) {
      return value;
    }
    var valueType = args.valueType;
    if (!valueType) {
      throw new Error("valueType is required when value is not an array of two dates");
    }
    return getRange(valueType, value);
  }();
  if (isRangeWithinRange(valueRange, dateRange)) {
    classes.push("".concat(className2, "--active"));
  } else if (doRangesOverlap(valueRange, dateRange)) {
    classes.push("".concat(className2, "--hasActive"));
  }
  var valueRangeClassNames = getRangeClassNames(valueRange, dateRange, "".concat(className2, "--range"));
  classes.push.apply(classes, valueRangeClassNames);
  var valueArray = Array.isArray(value) ? value : [value];
  if (hover && valueArray.length === 1) {
    var hoverRange = hover > valueRange[0] ? [valueRange[0], hover] : [hover, valueRange[0]];
    var hoverRangeClassNames = getRangeClassNames(hoverRange, dateRange, "".concat(className2, "--hover"));
    classes.push.apply(classes, hoverRangeClassNames);
  }
  return classes;
}
function TileGroup(_a2) {
  var className2 = _a2.className, _b = _a2.count, count = _b === void 0 ? 3 : _b, dateTransform = _a2.dateTransform, dateType2 = _a2.dateType, end = _a2.end, hover = _a2.hover, offset = _a2.offset, renderTile = _a2.renderTile, start = _a2.start, _c = _a2.step, step = _c === void 0 ? 1 : _c, value = _a2.value, valueType = _a2.valueType;
  var tiles = [];
  for (var point = start; point <= end; point += step) {
    var date = dateTransform(point);
    tiles.push(renderTile({
      classes: getTileClasses({
        date,
        dateType: dateType2,
        hover,
        value,
        valueType
      }),
      date
    }));
  }
  return u$1(Flex, { className: className2, count, offset, wrap: true, children: tiles });
}
function Tile(props) {
  var activeStartDate = props.activeStartDate, children = props.children, classes = props.classes, date = props.date, formatAbbr = props.formatAbbr, locale = props.locale, maxDate = props.maxDate, maxDateTransform = props.maxDateTransform, minDate = props.minDate, minDateTransform = props.minDateTransform, onClick = props.onClick, onMouseOver = props.onMouseOver, style = props.style, tileClassNameProps = props.tileClassName, tileContentProps = props.tileContent, tileDisabled = props.tileDisabled, view = props.view;
  var tileClassName = T$1(function() {
    var args = { activeStartDate, date, view };
    return typeof tileClassNameProps === "function" ? tileClassNameProps(args) : tileClassNameProps;
  }, [activeStartDate, date, tileClassNameProps, view]);
  var tileContent = T$1(function() {
    var args = { activeStartDate, date, view };
    return typeof tileContentProps === "function" ? tileContentProps(args) : tileContentProps;
  }, [activeStartDate, date, tileContentProps, view]);
  return u$1("button", { className: clsx(classes, tileClassName), disabled: minDate && minDateTransform(minDate) > date || maxDate && maxDateTransform(maxDate) < date || tileDisabled && tileDisabled({ activeStartDate, date, view }), onClick: onClick ? function(event) {
    return onClick(date, event);
  } : void 0, onFocus: onMouseOver ? function() {
    return onMouseOver(date);
  } : void 0, onMouseOver: onMouseOver ? function() {
    return onMouseOver(date);
  } : void 0, style, type: "button", children: [formatAbbr ? u$1("abbr", { "aria-label": formatAbbr(locale, date), children }) : children, tileContent] });
}
var __assign$j = function() {
  __assign$j = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$j.apply(this, arguments);
};
var __rest$e = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var className$5 = "react-calendar__century-view__decades__decade";
function Decade(_a2) {
  var _b = _a2.classes, classes = _b === void 0 ? [] : _b, currentCentury = _a2.currentCentury, _c = _a2.formatYear, formatYear$1 = _c === void 0 ? formatYear : _c, otherProps = __rest$e(_a2, ["classes", "currentCentury", "formatYear"]);
  var date = otherProps.date, locale = otherProps.locale;
  var classesProps = [];
  if (classes) {
    classesProps.push.apply(classesProps, classes);
  }
  {
    classesProps.push(className$5);
  }
  if (getCenturyStart(date).getFullYear() !== currentCentury) {
    classesProps.push("".concat(className$5, "--neighboringCentury"));
  }
  return u$1(Tile, __assign$j({}, otherProps, { classes: classesProps, maxDateTransform: getDecadeEnd, minDateTransform: getDecadeStart, view: "century", children: getDecadeLabel(locale, formatYear$1, date) }));
}
var __assign$i = function() {
  __assign$i = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$i.apply(this, arguments);
};
var __rest$d = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function Decades(props) {
  var activeStartDate = props.activeStartDate, hover = props.hover, showNeighboringCentury = props.showNeighboringCentury, value = props.value, valueType = props.valueType, otherProps = __rest$d(props, ["activeStartDate", "hover", "showNeighboringCentury", "value", "valueType"]);
  var start = getBeginOfCenturyYear(activeStartDate);
  var end = start + (showNeighboringCentury ? 119 : 99);
  return u$1(TileGroup, { className: "react-calendar__century-view__decades", dateTransform: getDecadeStart, dateType: "decade", end, hover, renderTile: function(_a2) {
    var date = _a2.date, otherTileProps = __rest$d(_a2, ["date"]);
    return u$1(Decade, __assign$i({}, otherProps, otherTileProps, { activeStartDate, currentCentury: start, date }), date.getTime());
  }, start, step: 10, value, valueType });
}
var __assign$h = function() {
  __assign$h = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$h.apply(this, arguments);
};
function CenturyView(props) {
  function renderDecades() {
    return u$1(Decades, __assign$h({}, props));
  }
  return u$1("div", { className: "react-calendar__century-view", children: renderDecades() });
}
var __assign$g = function() {
  __assign$g = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$g.apply(this, arguments);
};
var __rest$c = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var className$4 = "react-calendar__decade-view__years__year";
function Year(_a2) {
  var _b = _a2.classes, classes = _b === void 0 ? [] : _b, currentDecade = _a2.currentDecade, _c = _a2.formatYear, formatYear$1 = _c === void 0 ? formatYear : _c, otherProps = __rest$c(_a2, ["classes", "currentDecade", "formatYear"]);
  var date = otherProps.date, locale = otherProps.locale;
  var classesProps = [];
  if (classes) {
    classesProps.push.apply(classesProps, classes);
  }
  {
    classesProps.push(className$4);
  }
  if (getDecadeStart(date).getFullYear() !== currentDecade) {
    classesProps.push("".concat(className$4, "--neighboringDecade"));
  }
  return u$1(Tile, __assign$g({}, otherProps, { classes: classesProps, maxDateTransform: getYearEnd, minDateTransform: getYearStart, view: "decade", children: formatYear$1(locale, date) }));
}
var __assign$f = function() {
  __assign$f = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$f.apply(this, arguments);
};
var __rest$b = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function Years(props) {
  var activeStartDate = props.activeStartDate, hover = props.hover, showNeighboringDecade = props.showNeighboringDecade, value = props.value, valueType = props.valueType, otherProps = __rest$b(props, ["activeStartDate", "hover", "showNeighboringDecade", "value", "valueType"]);
  var start = getBeginOfDecadeYear(activeStartDate);
  var end = start + (showNeighboringDecade ? 11 : 9);
  return u$1(TileGroup, { className: "react-calendar__decade-view__years", dateTransform: getYearStart, dateType: "year", end, hover, renderTile: function(_a2) {
    var date = _a2.date, otherTileProps = __rest$b(_a2, ["date"]);
    return u$1(Year, __assign$f({}, otherProps, otherTileProps, { activeStartDate, currentDecade: start, date }), date.getTime());
  }, start, value, valueType });
}
var __assign$e = function() {
  __assign$e = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$e.apply(this, arguments);
};
function DecadeView(props) {
  function renderYears() {
    return u$1(Years, __assign$e({}, props));
  }
  return u$1("div", { className: "react-calendar__decade-view", children: renderYears() });
}
var __assign$d = function() {
  __assign$d = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$d.apply(this, arguments);
};
var __rest$a = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var __spreadArray$2 = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
    if (ar || !(i2 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
      ar[i2] = from[i2];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
var className$3 = "react-calendar__year-view__months__month";
function Month(_a2) {
  var _b = _a2.classes, classes = _b === void 0 ? [] : _b, _c = _a2.formatMonth, formatMonth2 = _c === void 0 ? formatMonth$1 : _c, _d = _a2.formatMonthYear, formatMonthYear$1 = _d === void 0 ? formatMonthYear : _d, otherProps = __rest$a(_a2, ["classes", "formatMonth", "formatMonthYear"]);
  var date = otherProps.date, locale = otherProps.locale;
  return u$1(Tile, __assign$d({}, otherProps, { classes: __spreadArray$2(__spreadArray$2([], classes, true), [className$3], false), formatAbbr: formatMonthYear$1, maxDateTransform: getMonthEnd, minDateTransform: getMonthStart, view: "year", children: formatMonth2(locale, date) }));
}
var __assign$c = function() {
  __assign$c = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$c.apply(this, arguments);
};
var __rest$9 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function Months(props) {
  var activeStartDate = props.activeStartDate, hover = props.hover, value = props.value, valueType = props.valueType, otherProps = __rest$9(props, ["activeStartDate", "hover", "value", "valueType"]);
  var start = 0;
  var end = 11;
  var year = getYear(activeStartDate);
  return u$1(TileGroup, { className: "react-calendar__year-view__months", dateTransform: function(monthIndex) {
    var date = /* @__PURE__ */ new Date();
    date.setFullYear(year, monthIndex, 1);
    return getMonthStart(date);
  }, dateType: "month", end, hover, renderTile: function(_a2) {
    var date = _a2.date, otherTileProps = __rest$9(_a2, ["date"]);
    return u$1(Month, __assign$c({}, otherProps, otherTileProps, { activeStartDate, date }), date.getTime());
  }, start, value, valueType });
}
var __assign$b = function() {
  __assign$b = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$b.apply(this, arguments);
};
function YearView(props) {
  function renderMonths() {
    return u$1(Months, __assign$b({}, props));
  }
  return u$1("div", { className: "react-calendar__year-view", children: renderMonths() });
}
var __assign$a = function() {
  __assign$a = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$a.apply(this, arguments);
};
var __rest$8 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var className$2 = "react-calendar__month-view__days__day";
function Day(_a2) {
  var calendarType = _a2.calendarType, _b = _a2.classes, classes = _b === void 0 ? [] : _b, currentMonthIndex = _a2.currentMonthIndex, _c = _a2.formatDay, formatDay$1 = _c === void 0 ? formatDay : _c, _d = _a2.formatLongDate, formatLongDate$1 = _d === void 0 ? formatLongDate : _d, otherProps = __rest$8(_a2, ["calendarType", "classes", "currentMonthIndex", "formatDay", "formatLongDate"]);
  var date = otherProps.date, locale = otherProps.locale;
  var classesProps = [];
  if (classes) {
    classesProps.push.apply(classesProps, classes);
  }
  {
    classesProps.push(className$2);
  }
  if (isWeekend(date, calendarType)) {
    classesProps.push("".concat(className$2, "--weekend"));
  }
  if (date.getMonth() !== currentMonthIndex) {
    classesProps.push("".concat(className$2, "--neighboringMonth"));
  }
  return u$1(Tile, __assign$a({}, otherProps, { classes: classesProps, formatAbbr: formatLongDate$1, maxDateTransform: getDayEnd, minDateTransform: getDayStart, view: "month", children: formatDay$1(locale, date) }));
}
var __assign$9 = function() {
  __assign$9 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$9.apply(this, arguments);
};
var __rest$7 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function Days(props) {
  var activeStartDate = props.activeStartDate, calendarType = props.calendarType, hover = props.hover, showFixedNumberOfWeeks = props.showFixedNumberOfWeeks, showNeighboringMonth = props.showNeighboringMonth, value = props.value, valueType = props.valueType, otherProps = __rest$7(props, ["activeStartDate", "calendarType", "hover", "showFixedNumberOfWeeks", "showNeighboringMonth", "value", "valueType"]);
  var year = getYear(activeStartDate);
  var monthIndex = getMonth(activeStartDate);
  var hasFixedNumberOfWeeks = showFixedNumberOfWeeks || showNeighboringMonth;
  var dayOfWeek = getDayOfWeek(activeStartDate, calendarType);
  var offset = hasFixedNumberOfWeeks ? 0 : dayOfWeek;
  var start = (hasFixedNumberOfWeeks ? -dayOfWeek : 0) + 1;
  var end = function() {
    if (showFixedNumberOfWeeks) {
      return start + 6 * 7 - 1;
    }
    var daysInMonth = getDaysInMonth(activeStartDate);
    if (showNeighboringMonth) {
      var activeEndDate = /* @__PURE__ */ new Date();
      activeEndDate.setFullYear(year, monthIndex, daysInMonth);
      activeEndDate.setHours(0, 0, 0, 0);
      var daysUntilEndOfTheWeek = 7 - getDayOfWeek(activeEndDate, calendarType) - 1;
      return daysInMonth + daysUntilEndOfTheWeek;
    }
    return daysInMonth;
  }();
  return u$1(TileGroup, { className: "react-calendar__month-view__days", count: 7, dateTransform: function(day) {
    var date = /* @__PURE__ */ new Date();
    date.setFullYear(year, monthIndex, day);
    return getDayStart(date);
  }, dateType: "day", hover, end, renderTile: function(_a2) {
    var date = _a2.date, otherTileProps = __rest$7(_a2, ["date"]);
    return u$1(Day, __assign$9({}, otherProps, otherTileProps, { activeStartDate, calendarType, currentMonthIndex: monthIndex, date }), date.getTime());
  }, offset, start, value, valueType });
}
var className$1 = "react-calendar__month-view__weekdays";
var weekdayClassName = "".concat(className$1, "__weekday");
function Weekdays(props) {
  var calendarType = props.calendarType, _a2 = props.formatShortWeekday, formatShortWeekday$1 = _a2 === void 0 ? formatShortWeekday : _a2, _b = props.formatWeekday, formatWeekday$1 = _b === void 0 ? formatWeekday : _b, locale = props.locale, onMouseLeave = props.onMouseLeave;
  var anyDate = /* @__PURE__ */ new Date();
  var beginOfMonth = getMonthStart(anyDate);
  var year = getYear(beginOfMonth);
  var monthIndex = getMonth(beginOfMonth);
  var weekdays = [];
  for (var weekday = 1; weekday <= 7; weekday += 1) {
    var weekdayDate = new Date(year, monthIndex, weekday - getDayOfWeek(beginOfMonth, calendarType));
    var abbr = formatWeekday$1(locale, weekdayDate);
    weekdays.push(u$1("div", { className: clsx(weekdayClassName, isCurrentDayOfWeek(weekdayDate) && "".concat(weekdayClassName, "--current"), isWeekend(weekdayDate, calendarType) && "".concat(weekdayClassName, "--weekend")), children: u$1("abbr", { "aria-label": abbr, title: abbr, children: formatShortWeekday$1(locale, weekdayDate).replace(".", "") }) }, weekday));
  }
  return u$1(Flex, { className: className$1, count: 7, onFocus: onMouseLeave, onMouseOver: onMouseLeave, children: weekdays });
}
var __assign$8 = function() {
  __assign$8 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$8.apply(this, arguments);
};
var __rest$6 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var className = "react-calendar__tile";
function WeekNumber(props) {
  var onClickWeekNumber = props.onClickWeekNumber, weekNumber = props.weekNumber;
  var children = u$1("span", { children: weekNumber });
  if (onClickWeekNumber) {
    var date_1 = props.date, onClickWeekNumber_1 = props.onClickWeekNumber, weekNumber_1 = props.weekNumber, otherProps = __rest$6(props, ["date", "onClickWeekNumber", "weekNumber"]);
    return u$1("button", __assign$8({}, otherProps, { className, onClick: function(event) {
      return onClickWeekNumber_1(weekNumber_1, date_1, event);
    }, type: "button", children }));
  } else {
    props.date;
    props.onClickWeekNumber;
    props.weekNumber;
    var otherProps = __rest$6(props, ["date", "onClickWeekNumber", "weekNumber"]);
    return u$1("div", __assign$8({}, otherProps, { className, children }));
  }
}
function WeekNumbers(props) {
  var activeStartDate = props.activeStartDate, calendarType = props.calendarType, onClickWeekNumber = props.onClickWeekNumber, onMouseLeave = props.onMouseLeave, showFixedNumberOfWeeks = props.showFixedNumberOfWeeks;
  var numberOfWeeks = function() {
    if (showFixedNumberOfWeeks) {
      return 6;
    }
    var numberOfDays = getDaysInMonth(activeStartDate);
    var startWeekday = getDayOfWeek(activeStartDate, calendarType);
    var days = numberOfDays - (7 - startWeekday);
    return 1 + Math.ceil(days / 7);
  }();
  var dates = function() {
    var year = getYear(activeStartDate);
    var monthIndex = getMonth(activeStartDate);
    var day = getDate(activeStartDate);
    var result = [];
    for (var index = 0; index < numberOfWeeks; index += 1) {
      result.push(getBeginOfWeek(new Date(year, monthIndex, day + index * 7), calendarType));
    }
    return result;
  }();
  var weekNumbers = dates.map(function(date) {
    return getWeekNumber(date, calendarType);
  });
  return u$1(Flex, { className: "react-calendar__month-view__weekNumbers", count: numberOfWeeks, direction: "column", onFocus: onMouseLeave, onMouseOver: onMouseLeave, style: { flexBasis: "calc(100% * (1 / 8)", flexShrink: 0 }, children: weekNumbers.map(function(weekNumber, weekIndex) {
    var date = dates[weekIndex];
    if (!date) {
      throw new Error("date is not defined");
    }
    return u$1(WeekNumber, { date, onClickWeekNumber, weekNumber }, weekNumber);
  }) });
}
var __assign$7 = function() {
  __assign$7 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$7.apply(this, arguments);
};
var __rest$5 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function getCalendarTypeFromLocale(locale) {
  if (locale) {
    for (var _i = 0, _a2 = Object.entries(CALENDAR_TYPE_LOCALES); _i < _a2.length; _i++) {
      var _b = _a2[_i], calendarType = _b[0], locales = _b[1];
      if (locales.includes(locale)) {
        return calendarType;
      }
    }
  }
  return CALENDAR_TYPES.ISO_8601;
}
function MonthView(props) {
  var activeStartDate = props.activeStartDate, locale = props.locale, onMouseLeave = props.onMouseLeave, showFixedNumberOfWeeks = props.showFixedNumberOfWeeks;
  var _a2 = props.calendarType, calendarType = _a2 === void 0 ? getCalendarTypeFromLocale(locale) : _a2, formatShortWeekday2 = props.formatShortWeekday, formatWeekday2 = props.formatWeekday, onClickWeekNumber = props.onClickWeekNumber, showWeekNumbers = props.showWeekNumbers, childProps = __rest$5(props, ["calendarType", "formatShortWeekday", "formatWeekday", "onClickWeekNumber", "showWeekNumbers"]);
  function renderWeekdays() {
    return u$1(Weekdays, { calendarType, formatShortWeekday: formatShortWeekday2, formatWeekday: formatWeekday2, locale, onMouseLeave });
  }
  function renderWeekNumbers() {
    if (!showWeekNumbers) {
      return null;
    }
    return u$1(WeekNumbers, { activeStartDate, calendarType, onClickWeekNumber, onMouseLeave, showFixedNumberOfWeeks });
  }
  function renderDays() {
    return u$1(Days, __assign$7({ calendarType }, childProps));
  }
  var className2 = "react-calendar__month-view";
  return u$1("div", { className: clsx(className2, showWeekNumbers ? "".concat(className2, "--weekNumbers") : ""), children: u$1("div", { style: {
    display: "flex",
    alignItems: "flex-end"
  }, children: [renderWeekNumbers(), u$1("div", { style: {
    flexGrow: 1,
    width: "100%"
  }, children: [renderWeekdays(), renderDays()] })] }) });
}
var __assign$6 = function() {
  __assign$6 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$6.apply(this, arguments);
};
var baseClassName$1 = "react-calendar";
var allViews$1 = ["century", "decade", "year", "month"];
var allValueTypes$1 = ["decade", "year", "month", "day"];
var defaultMinDate$1 = /* @__PURE__ */ new Date();
defaultMinDate$1.setFullYear(1, 0, 1);
defaultMinDate$1.setHours(0, 0, 0, 0);
var defaultMaxDate$1 = /* @__PURE__ */ new Date(864e13);
function toDate$1(value) {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}
function getLimitedViews(minDetail, maxDetail) {
  return allViews$1.slice(allViews$1.indexOf(minDetail), allViews$1.indexOf(maxDetail) + 1);
}
function isViewAllowed(view, minDetail, maxDetail) {
  var views = getLimitedViews(minDetail, maxDetail);
  return views.indexOf(view) !== -1;
}
function getView(view, minDetail, maxDetail) {
  if (!view) {
    return maxDetail;
  }
  if (isViewAllowed(view, minDetail, maxDetail)) {
    return view;
  }
  return maxDetail;
}
function getValueType$1(view) {
  var index = allViews$1.indexOf(view);
  return allValueTypes$1[index];
}
function getValue$1(value, index) {
  var rawValue = Array.isArray(value) ? value[index] : value;
  if (!rawValue) {
    return null;
  }
  var valueDate = toDate$1(rawValue);
  if (isNaN(valueDate.getTime())) {
    throw new Error("Invalid date: ".concat(value));
  }
  return valueDate;
}
function getDetailValue$1(_a2, index) {
  var value = _a2.value, minDate = _a2.minDate, maxDate = _a2.maxDate, maxDetail = _a2.maxDetail;
  var valuePiece = getValue$1(value, index);
  if (!valuePiece) {
    return null;
  }
  var valueType = getValueType$1(maxDetail);
  var detailValueFrom = function() {
    switch (index) {
      case 0:
        return getBegin$1(valueType, valuePiece);
      case 1:
        return getEnd$1(valueType, valuePiece);
      default:
        throw new Error("Invalid index value: ".concat(index));
    }
  }();
  return between$1(detailValueFrom, minDate, maxDate);
}
var getDetailValueFrom$1 = function(args) {
  return getDetailValue$1(args, 0);
};
var getDetailValueTo$1 = function(args) {
  return getDetailValue$1(args, 1);
};
var getDetailValueArray$1 = function(args) {
  return [getDetailValueFrom$1, getDetailValueTo$1].map(function(fn2) {
    return fn2(args);
  });
};
function getActiveStartDate(_a2) {
  var maxDate = _a2.maxDate, maxDetail = _a2.maxDetail, minDate = _a2.minDate, minDetail = _a2.minDetail, value = _a2.value, view = _a2.view;
  var rangeType = getView(view, minDetail, maxDetail);
  var valueFrom = getDetailValueFrom$1({
    value,
    minDate,
    maxDate,
    maxDetail
  }) || /* @__PURE__ */ new Date();
  return getBegin$1(rangeType, valueFrom);
}
function getInitialActiveStartDate(_a2) {
  var activeStartDate = _a2.activeStartDate, defaultActiveStartDate = _a2.defaultActiveStartDate, defaultValue = _a2.defaultValue, defaultView = _a2.defaultView, maxDate = _a2.maxDate, maxDetail = _a2.maxDetail, minDate = _a2.minDate, minDetail = _a2.minDetail, value = _a2.value, view = _a2.view;
  var rangeType = getView(view, minDetail, maxDetail);
  var valueFrom = activeStartDate || defaultActiveStartDate;
  if (valueFrom) {
    return getBegin$1(rangeType, valueFrom);
  }
  return getActiveStartDate({
    maxDate,
    maxDetail,
    minDate,
    minDetail,
    value: value || defaultValue,
    view: view || defaultView
  });
}
function getIsSingleValue(value) {
  return value && (!Array.isArray(value) || value.length === 1);
}
function areDatesEqual(date1, date2) {
  return date1 instanceof Date && date2 instanceof Date && date1.getTime() === date2.getTime();
}
var Calendar = k(function Calendar2(props, ref) {
  var activeStartDateProps = props.activeStartDate, allowPartialRange = props.allowPartialRange, calendarType = props.calendarType, className2 = props.className, defaultActiveStartDate = props.defaultActiveStartDate, defaultValue = props.defaultValue, defaultView = props.defaultView, formatDay2 = props.formatDay, formatLongDate2 = props.formatLongDate, formatMonth2 = props.formatMonth, formatMonthYear2 = props.formatMonthYear, formatShortWeekday2 = props.formatShortWeekday, formatWeekday2 = props.formatWeekday, formatYear2 = props.formatYear, _a2 = props.goToRangeStartOnSelect, goToRangeStartOnSelect = _a2 === void 0 ? true : _a2, inputRef = props.inputRef, locale = props.locale, _b = props.maxDate, maxDate = _b === void 0 ? defaultMaxDate$1 : _b, _c = props.maxDetail, maxDetail = _c === void 0 ? "month" : _c, _d = props.minDate, minDate = _d === void 0 ? defaultMinDate$1 : _d, _e = props.minDetail, minDetail = _e === void 0 ? "century" : _e, navigationAriaLabel = props.navigationAriaLabel, navigationAriaLive = props.navigationAriaLive, navigationLabel = props.navigationLabel, next2AriaLabel = props.next2AriaLabel, next2Label = props.next2Label, nextAriaLabel = props.nextAriaLabel, nextLabel = props.nextLabel, onActiveStartDateChange = props.onActiveStartDateChange, onChangeProps = props.onChange, onClickDay = props.onClickDay, onClickDecade = props.onClickDecade, onClickMonth = props.onClickMonth, onClickWeekNumber = props.onClickWeekNumber, onClickYear = props.onClickYear, onDrillDown = props.onDrillDown, onDrillUp = props.onDrillUp, onViewChange = props.onViewChange, prev2AriaLabel = props.prev2AriaLabel, prev2Label = props.prev2Label, prevAriaLabel = props.prevAriaLabel, prevLabel = props.prevLabel, _f = props.returnValue, returnValue = _f === void 0 ? "start" : _f, selectRange = props.selectRange, showDoubleView = props.showDoubleView, showFixedNumberOfWeeks = props.showFixedNumberOfWeeks, _g = props.showNavigation, showNavigation = _g === void 0 ? true : _g, showNeighboringCentury = props.showNeighboringCentury, showNeighboringDecade = props.showNeighboringDecade, _h = props.showNeighboringMonth, showNeighboringMonth = _h === void 0 ? true : _h, showWeekNumbers = props.showWeekNumbers, tileClassName = props.tileClassName, tileContent = props.tileContent, tileDisabled = props.tileDisabled, valueProps = props.value, viewProps = props.view;
  var _j = h(defaultActiveStartDate), activeStartDateState = _j[0], setActiveStartDateState = _j[1];
  var _k = h(null), hoverState = _k[0], setHoverState = _k[1];
  var _l = h(Array.isArray(defaultValue) ? defaultValue.map(function(el) {
    return el !== null ? toDate$1(el) : null;
  }) : defaultValue !== null && defaultValue !== void 0 ? toDate$1(defaultValue) : null), valueState = _l[0], setValueState = _l[1];
  var _m = h(defaultView), viewState = _m[0], setViewState = _m[1];
  var activeStartDate = activeStartDateProps || activeStartDateState || getInitialActiveStartDate({
    activeStartDate: activeStartDateProps,
    defaultActiveStartDate,
    defaultValue,
    defaultView,
    maxDate,
    maxDetail,
    minDate,
    minDetail,
    value: valueProps,
    view: viewProps
  });
  var value = function() {
    var rawValue = function() {
      if (selectRange && getIsSingleValue(valueState)) {
        return valueState;
      }
      return valueProps !== void 0 ? valueProps : valueState;
    }();
    if (!rawValue) {
      return null;
    }
    return Array.isArray(rawValue) ? rawValue.map(function(el) {
      return el !== null ? toDate$1(el) : null;
    }) : rawValue !== null ? toDate$1(rawValue) : null;
  }();
  var valueType = getValueType$1(maxDetail);
  var view = getView(viewProps || viewState, minDetail, maxDetail);
  var views = getLimitedViews(minDetail, maxDetail);
  var hover = selectRange ? hoverState : null;
  var drillDownAvailable = views.indexOf(view) < views.length - 1;
  var drillUpAvailable = views.indexOf(view) > 0;
  var getProcessedValue = q(function(value2) {
    var processFunction = function() {
      switch (returnValue) {
        case "start":
          return getDetailValueFrom$1;
        case "end":
          return getDetailValueTo$1;
        case "range":
          return getDetailValueArray$1;
        default:
          throw new Error("Invalid returnValue.");
      }
    }();
    return processFunction({
      maxDate,
      maxDetail,
      minDate,
      value: value2
    });
  }, [maxDate, maxDetail, minDate, returnValue]);
  var setActiveStartDate = q(function(nextActiveStartDate, action) {
    setActiveStartDateState(nextActiveStartDate);
    var args = {
      action,
      activeStartDate: nextActiveStartDate,
      value,
      view
    };
    if (onActiveStartDateChange && !areDatesEqual(activeStartDate, nextActiveStartDate)) {
      onActiveStartDateChange(args);
    }
  }, [activeStartDate, onActiveStartDateChange, value, view]);
  var onClickTile = q(function(value2, event) {
    var callback = function() {
      switch (view) {
        case "century":
          return onClickDecade;
        case "decade":
          return onClickYear;
        case "year":
          return onClickMonth;
        case "month":
          return onClickDay;
        default:
          throw new Error("Invalid view: ".concat(view, "."));
      }
    }();
    if (callback)
      callback(value2, event);
  }, [onClickDay, onClickDecade, onClickMonth, onClickYear, view]);
  var drillDown = q(function(nextActiveStartDate, event) {
    if (!drillDownAvailable) {
      return;
    }
    onClickTile(nextActiveStartDate, event);
    var nextView = views[views.indexOf(view) + 1];
    if (!nextView) {
      throw new Error("Attempted to drill down from the lowest view.");
    }
    setActiveStartDateState(nextActiveStartDate);
    setViewState(nextView);
    var args = {
      action: "drillDown",
      activeStartDate: nextActiveStartDate,
      value,
      view: nextView
    };
    if (onActiveStartDateChange && !areDatesEqual(activeStartDate, nextActiveStartDate)) {
      onActiveStartDateChange(args);
    }
    if (onViewChange && view !== nextView) {
      onViewChange(args);
    }
    if (onDrillDown) {
      onDrillDown(args);
    }
  }, [
    activeStartDate,
    drillDownAvailable,
    onActiveStartDateChange,
    onClickTile,
    onDrillDown,
    onViewChange,
    value,
    view,
    views
  ]);
  var drillUp = q(function() {
    if (!drillUpAvailable) {
      return;
    }
    var nextView = views[views.indexOf(view) - 1];
    if (!nextView) {
      throw new Error("Attempted to drill up from the highest view.");
    }
    var nextActiveStartDate = getBegin$1(nextView, activeStartDate);
    setActiveStartDateState(nextActiveStartDate);
    setViewState(nextView);
    var args = {
      action: "drillUp",
      activeStartDate: nextActiveStartDate,
      value,
      view: nextView
    };
    if (onActiveStartDateChange && !areDatesEqual(activeStartDate, nextActiveStartDate)) {
      onActiveStartDateChange(args);
    }
    if (onViewChange && view !== nextView) {
      onViewChange(args);
    }
    if (onDrillUp) {
      onDrillUp(args);
    }
  }, [
    activeStartDate,
    drillUpAvailable,
    onActiveStartDateChange,
    onDrillUp,
    onViewChange,
    value,
    view,
    views
  ]);
  var onChange = q(function(rawNextValue, event) {
    var previousValue = value;
    onClickTile(rawNextValue, event);
    var isFirstValueInRange = selectRange && !getIsSingleValue(previousValue);
    var nextValue;
    if (selectRange) {
      if (isFirstValueInRange) {
        nextValue = getBegin$1(valueType, rawNextValue);
      } else {
        if (!previousValue) {
          throw new Error("previousValue is required");
        }
        if (Array.isArray(previousValue)) {
          throw new Error("previousValue must not be an array");
        }
        nextValue = getValueRange(valueType, previousValue, rawNextValue);
      }
    } else {
      nextValue = getProcessedValue(rawNextValue);
    }
    var nextActiveStartDate = (
      // Range selection turned off
      !selectRange || // Range selection turned on, first value
      isFirstValueInRange || // Range selection turned on, second value, goToRangeStartOnSelect toggled on
      goToRangeStartOnSelect ? getActiveStartDate({
        maxDate,
        maxDetail,
        minDate,
        minDetail,
        value: nextValue,
        view
      }) : null
    );
    event.persist();
    setActiveStartDateState(nextActiveStartDate);
    setValueState(nextValue);
    var args = {
      action: "onChange",
      activeStartDate: nextActiveStartDate,
      value: nextValue,
      view
    };
    if (onActiveStartDateChange && !areDatesEqual(activeStartDate, nextActiveStartDate)) {
      onActiveStartDateChange(args);
    }
    if (onChangeProps) {
      if (selectRange) {
        var isSingleValue = getIsSingleValue(nextValue);
        if (!isSingleValue) {
          onChangeProps(nextValue || null, event);
        } else if (allowPartialRange) {
          if (Array.isArray(nextValue)) {
            throw new Error("value must not be an array");
          }
          onChangeProps([nextValue || null, null], event);
        }
      } else {
        onChangeProps(nextValue || null, event);
      }
    }
  }, [
    activeStartDate,
    allowPartialRange,
    getProcessedValue,
    goToRangeStartOnSelect,
    maxDate,
    maxDetail,
    minDate,
    minDetail,
    onActiveStartDateChange,
    onChangeProps,
    onClickTile,
    selectRange,
    value,
    valueType,
    view
  ]);
  function onMouseOver(nextHover) {
    setHoverState(nextHover);
  }
  function onMouseLeave() {
    setHoverState(null);
  }
  F(ref, function() {
    return {
      activeStartDate,
      drillDown,
      drillUp,
      onChange,
      setActiveStartDate,
      value,
      view
    };
  }, [activeStartDate, drillDown, drillUp, onChange, setActiveStartDate, value, view]);
  function renderContent(next) {
    var currentActiveStartDate = next ? getBeginNext(view, activeStartDate) : getBegin$1(view, activeStartDate);
    var onClick = drillDownAvailable ? drillDown : onChange;
    var commonProps = {
      activeStartDate: currentActiveStartDate,
      hover,
      locale,
      maxDate,
      minDate,
      onClick,
      onMouseOver: selectRange ? onMouseOver : void 0,
      tileClassName,
      tileContent,
      tileDisabled,
      value,
      valueType
    };
    switch (view) {
      case "century": {
        return u$1(CenturyView, __assign$6({ formatYear: formatYear2, showNeighboringCentury }, commonProps));
      }
      case "decade": {
        return u$1(DecadeView, __assign$6({ formatYear: formatYear2, showNeighboringDecade }, commonProps));
      }
      case "year": {
        return u$1(YearView, __assign$6({ formatMonth: formatMonth2, formatMonthYear: formatMonthYear2 }, commonProps));
      }
      case "month": {
        return u$1(MonthView, __assign$6({ calendarType, formatDay: formatDay2, formatLongDate: formatLongDate2, formatShortWeekday: formatShortWeekday2, formatWeekday: formatWeekday2, onClickWeekNumber, onMouseLeave: selectRange ? onMouseLeave : void 0, showFixedNumberOfWeeks: typeof showFixedNumberOfWeeks !== "undefined" ? showFixedNumberOfWeeks : showDoubleView, showNeighboringMonth, showWeekNumbers }, commonProps));
      }
      default:
        throw new Error("Invalid view: ".concat(view, "."));
    }
  }
  function renderNavigation() {
    if (!showNavigation) {
      return null;
    }
    return u$1(Navigation, { activeStartDate, drillUp, formatMonthYear: formatMonthYear2, formatYear: formatYear2, locale, maxDate, minDate, navigationAriaLabel, navigationAriaLive, navigationLabel, next2AriaLabel, next2Label, nextAriaLabel, nextLabel, prev2AriaLabel, prev2Label, prevAriaLabel, prevLabel, setActiveStartDate, showDoubleView, view, views });
  }
  var valueArray = Array.isArray(value) ? value : [value];
  return u$1("div", { className: clsx(baseClassName$1, selectRange && valueArray.length === 1 && "".concat(baseClassName$1, "--selectRange"), showDoubleView && "".concat(baseClassName$1, "--doubleView"), className2), ref: inputRef, children: [renderNavigation(), u$1("div", { className: "".concat(baseClassName$1, "__viewContainer"), onBlur: selectRange ? onMouseLeave : void 0, onMouseLeave: selectRange ? onMouseLeave : void 0, children: [renderContent(), showDoubleView ? renderContent(true) : null] })] });
});
function getRect(element) {
  return element.getBoundingClientRect();
}
function detectElementOverflow(element, container) {
  return {
    get collidedTop() {
      return getRect(element).top < getRect(container).top;
    },
    get collidedBottom() {
      return getRect(element).bottom > getRect(container).bottom;
    },
    get collidedLeft() {
      return getRect(element).left < getRect(container).left;
    },
    get collidedRight() {
      return getRect(element).right > getRect(container).right;
    },
    get overflowTop() {
      return getRect(container).top - getRect(element).top;
    },
    get overflowBottom() {
      return getRect(element).bottom - getRect(container).bottom;
    },
    get overflowLeft() {
      return getRect(container).left - getRect(element).left;
    },
    get overflowRight() {
      return getRect(element).right - getRect(container).right;
    }
  };
}
var warning = function() {
};
var warning_1 = warning;
const warning$1 = /* @__PURE__ */ getDefaultExportFromCjs(warning_1);
var __assign$5 = function() {
  __assign$5 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$5.apply(this, arguments);
};
var __rest$4 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var isBrowser$1 = typeof document !== "undefined";
var isMutationObserverSupported = isBrowser$1 && "MutationObserver" in window;
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
function findScrollContainer(element) {
  var parent = element.parentElement;
  while (parent) {
    var overflow = window.getComputedStyle(parent).overflow;
    if (overflow.split(" ").every(function(o2) {
      return o2 === "auto" || o2 === "scroll";
    })) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.documentElement;
}
function alignAxis(_a2) {
  var axis = _a2.axis, container = _a2.container, element = _a2.element, invertAxis = _a2.invertAxis, scrollContainer = _a2.scrollContainer, secondary = _a2.secondary, spacing = _a2.spacing;
  var style = window.getComputedStyle(element);
  var parent = container.parentElement;
  if (!parent) {
    return;
  }
  var scrollContainerCollisions = detectElementOverflow(parent, scrollContainer);
  var documentCollisions = detectElementOverflow(parent, document.documentElement);
  var isX = axis === "x";
  var startProperty = isX ? "left" : "top";
  var endProperty = isX ? "right" : "bottom";
  var sizeProperty = isX ? "width" : "height";
  var overflowStartProperty = "overflow".concat(capitalize(startProperty));
  var overflowEndProperty = "overflow".concat(capitalize(endProperty));
  var scrollProperty = "scroll".concat(capitalize(startProperty));
  var uppercasedSizeProperty = capitalize(sizeProperty);
  var offsetSizeProperty = "offset".concat(uppercasedSizeProperty);
  var clientSizeProperty = "client".concat(uppercasedSizeProperty);
  var minSizeProperty = "min-".concat(sizeProperty);
  var scrollbarWidth = scrollContainer[offsetSizeProperty] - scrollContainer[clientSizeProperty];
  var startSpacing = typeof spacing === "object" ? spacing[startProperty] : spacing;
  var availableStartSpace = -Math.max(scrollContainerCollisions[overflowStartProperty], documentCollisions[overflowStartProperty] + document.documentElement[scrollProperty]) - startSpacing;
  var endSpacing = typeof spacing === "object" ? spacing[endProperty] : spacing;
  var availableEndSpace = -Math.max(scrollContainerCollisions[overflowEndProperty], documentCollisions[overflowEndProperty] - document.documentElement[scrollProperty]) - endSpacing - scrollbarWidth;
  if (secondary) {
    availableStartSpace += parent[clientSizeProperty];
    availableEndSpace += parent[clientSizeProperty];
  }
  var offsetSize = element[offsetSizeProperty];
  function displayStart() {
    element.style[startProperty] = "auto";
    element.style[endProperty] = secondary ? "0" : "100%";
  }
  function displayEnd() {
    element.style[startProperty] = secondary ? "0" : "100%";
    element.style[endProperty] = "auto";
  }
  function displayIfFits(availableSpace, display) {
    var fits2 = offsetSize <= availableSpace;
    if (fits2) {
      display();
    }
    return fits2;
  }
  function displayStartIfFits() {
    return displayIfFits(availableStartSpace, displayStart);
  }
  function displayEndIfFits() {
    return displayIfFits(availableEndSpace, displayEnd);
  }
  function displayWhereverShrinkedFits() {
    var moreSpaceStart = availableStartSpace > availableEndSpace;
    var rawMinSize = style.getPropertyValue(minSizeProperty);
    var minSize = rawMinSize ? parseInt(rawMinSize, 10) : null;
    function shrinkToSize(size) {
      warning$1(!minSize || size >= minSize, "<Fit />'s child will not fit anywhere with its current ".concat(minSizeProperty, " of ").concat(minSize, "px."));
      var newSize = Math.max(size, minSize || 0);
      warning$1(false, "<Fit />'s child needed to have its ".concat(sizeProperty, " decreased to ").concat(newSize, "px."));
      element.style[sizeProperty] = "".concat(newSize, "px");
    }
    if (moreSpaceStart) {
      shrinkToSize(availableStartSpace);
      displayStart();
    } else {
      shrinkToSize(availableEndSpace);
      displayEnd();
    }
  }
  var fits;
  if (invertAxis) {
    fits = displayStartIfFits() || displayEndIfFits();
  } else {
    fits = displayEndIfFits() || displayStartIfFits();
  }
  if (!fits) {
    displayWhereverShrinkedFits();
  }
}
function alignMainAxis(args) {
  alignAxis(args);
}
function alignSecondaryAxis(args) {
  alignAxis(__assign$5(__assign$5({}, args), { axis: args.axis === "x" ? "y" : "x", secondary: true }));
}
function alignBothAxis(args) {
  var invertAxis = args.invertAxis, invertSecondaryAxis = args.invertSecondaryAxis, commonArgs = __rest$4(args, ["invertAxis", "invertSecondaryAxis"]);
  alignMainAxis(__assign$5(__assign$5({}, commonArgs), { invertAxis }));
  alignSecondaryAxis(__assign$5(__assign$5({}, commonArgs), { invertAxis: invertSecondaryAxis }));
}
function Fit(_a2) {
  var children = _a2.children, invertAxis = _a2.invertAxis, invertSecondaryAxis = _a2.invertSecondaryAxis, _b = _a2.mainAxis, mainAxis = _b === void 0 ? "y" : _b, _c = _a2.spacing, spacing = _c === void 0 ? 8 : _c;
  var container = A$1(void 0);
  var element = A$1(void 0);
  var elementWidth = A$1(void 0);
  var elementHeight = A$1(void 0);
  var scrollContainer = A$1(void 0);
  var fit = q(function() {
    if (!scrollContainer.current || !container.current || !element.current) {
      return;
    }
    var currentElementWidth = element.current.clientWidth;
    var currentElementHeight = element.current.clientHeight;
    if (elementWidth.current === currentElementWidth && elementHeight.current === currentElementHeight) {
      return;
    }
    elementWidth.current = currentElementWidth;
    elementHeight.current = currentElementHeight;
    var parent = container.current.parentElement;
    if (!parent) {
      return;
    }
    var style = window.getComputedStyle(element.current);
    var position = style.position;
    if (position !== "absolute") {
      element.current.style.position = "absolute";
    }
    var parentStyle = window.getComputedStyle(parent);
    var parentPosition = parentStyle.position;
    if (parentPosition !== "relative" && parentPosition !== "absolute") {
      parent.style.position = "relative";
    }
    alignBothAxis({
      axis: mainAxis,
      container: container.current,
      element: element.current,
      invertAxis,
      invertSecondaryAxis,
      scrollContainer: scrollContainer.current,
      spacing
    });
  }, [invertAxis, invertSecondaryAxis, mainAxis, spacing]);
  var child = N.only(children);
  y(function() {
    fit();
    function onMutation() {
      fit();
    }
    if (isMutationObserverSupported && element.current) {
      var mutationObserver = new MutationObserver(onMutation);
      mutationObserver.observe(element.current, {
        attributes: true,
        attributeFilter: ["class", "style"]
      });
    }
  }, [fit]);
  function assignRefs(domElement) {
    if (!domElement || !(domElement instanceof HTMLElement)) {
      return;
    }
    element.current = domElement;
    scrollContainer.current = findScrollContainer(domElement);
  }
  return u$1("span", { ref: function(domContainer) {
    if (!domContainer) {
      return;
    }
    container.current = domContainer;
    var domElement = domContainer === null || domContainer === void 0 ? void 0 : domContainer.firstElementChild;
    assignRefs(domElement);
  }, style: { display: "contents" }, children: child });
}
function Divider(_a2) {
  var children = _a2.children;
  return u$1("span", { className: "react-date-picker__inputGroup__divider", children });
}
var allowedVariants = ["normal", "small-caps"];
function getFontShorthand(element) {
  if (!element) {
    return "";
  }
  var style = window.getComputedStyle(element);
  if (style.font) {
    return style.font;
  }
  var isFontDefined = style.fontFamily !== "";
  if (!isFontDefined) {
    return "";
  }
  var fontVariant = allowedVariants.includes(style.fontVariant) ? style.fontVariant : "normal";
  return "".concat(style.fontStyle, " ").concat(fontVariant, " ").concat(style.fontWeight, " ").concat(style.fontSize, " / ").concat(style.lineHeight, " ").concat(style.fontFamily);
}
var cachedCanvas;
function measureText(text, font) {
  var canvas = cachedCanvas || (cachedCanvas = document.createElement("canvas"));
  var context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.font = font;
  var width = context.measureText(text).width;
  return Math.ceil(width);
}
function updateInputWidth(element) {
  if (typeof document === "undefined" || !element) {
    return null;
  }
  var font = getFontShorthand(element);
  var text = element.value || element.placeholder;
  var width = measureText(text, font);
  if (width === null) {
    return null;
  }
  element.style.width = "".concat(width, "px");
  return width;
}
var isBrowser = typeof document !== "undefined";
var useIsomorphicLayoutEffect = isBrowser ? _ : y;
var isIEOrEdgeLegacy = isBrowser && /(MSIE|Trident\/|Edge\/)/.test(navigator.userAgent);
var isFirefox = isBrowser && /Firefox/.test(navigator.userAgent);
function onFocus(event) {
  var target2 = event.target;
  if (isIEOrEdgeLegacy) {
    requestAnimationFrame(function() {
      return target2.select();
    });
  } else {
    target2.select();
  }
}
function updateInputWidthOnLoad(element) {
  if (document.readyState === "complete") {
    return;
  }
  function onLoad() {
    updateInputWidth(element);
  }
  window.addEventListener("load", onLoad);
}
function updateInputWidthOnFontLoad(element) {
  if (!document.fonts) {
    return;
  }
  var font = getFontShorthand(element);
  if (!font) {
    return;
  }
  var isFontLoaded = document.fonts.check(font);
  if (isFontLoaded) {
    return;
  }
  function onLoadingDone() {
    updateInputWidth(element);
  }
  document.fonts.addEventListener("loadingdone", onLoadingDone);
}
function getSelectionString(input) {
  if (input && "selectionStart" in input && input.selectionStart !== null && "selectionEnd" in input && input.selectionEnd !== null) {
    return input.value.slice(input.selectionStart, input.selectionEnd);
  }
  if ("getSelection" in window) {
    var selection = window.getSelection();
    return selection && selection.toString();
  }
  return null;
}
function makeOnKeyPress(maxLength) {
  if (maxLength === null) {
    return void 0;
  }
  return function onKeyPress(event) {
    if (isFirefox) {
      return;
    }
    var key = event.key, input = event.target;
    var value = input.value;
    var isNumberKey = key.length === 1 && /\d/.test(key);
    var selection = getSelectionString(input);
    if (!isNumberKey || !(selection || value.length < maxLength)) {
      event.preventDefault();
    }
  };
}
function Input(_a2) {
  var ariaLabel = _a2.ariaLabel, autoFocus = _a2.autoFocus, className2 = _a2.className, disabled = _a2.disabled, inputRef = _a2.inputRef, max = _a2.max, min = _a2.min, name = _a2.name, nameForClass = _a2.nameForClass, onChange = _a2.onChange, onKeyDown = _a2.onKeyDown, onKeyUp = _a2.onKeyUp, _b = _a2.placeholder, placeholder = _b === void 0 ? "--" : _b, required = _a2.required, showLeadingZeros = _a2.showLeadingZeros, step = _a2.step, value = _a2.value;
  useIsomorphicLayoutEffect(function() {
    if (!inputRef || !inputRef.current) {
      return;
    }
    updateInputWidth(inputRef.current);
    updateInputWidthOnLoad(inputRef.current);
    updateInputWidthOnFontLoad(inputRef.current);
  }, [inputRef, value]);
  var hasLeadingZero = showLeadingZeros && value && Number(value) < 10 && (value === "0" || !value.toString().startsWith("0"));
  var maxLength = max ? max.toString().length : null;
  return u$1(b, { children: [hasLeadingZero ? u$1("span", { className: "".concat(className2, "__leadingZero"), children: "0" }) : null, u$1("input", {
    "aria-label": ariaLabel,
    autoComplete: "off",
    autoFocus,
    className: clsx("".concat(className2, "__input"), "".concat(className2, "__").concat(nameForClass || name), hasLeadingZero && "".concat(className2, "__input--hasLeadingZero")),
    "data-input": "true",
    disabled,
    inputMode: "numeric",
    max,
    min,
    name,
    onChange,
    onFocus,
    onKeyDown,
    onKeyPress: makeOnKeyPress(maxLength),
    onKeyUp: function(event) {
      updateInputWidth(event.target);
      if (onKeyUp) {
        onKeyUp(event);
      }
    },
    placeholder,
    // Assertion is needed for React 18 compatibility
    ref: inputRef,
    required,
    step,
    type: "number",
    value: value !== null ? value : ""
  })] });
}
function between(value, min, max) {
  if (min && min > value) {
    return min;
  }
  if (max && max < value) {
    return max;
  }
  return value;
}
function isValidNumber(num) {
  return num !== null && num !== false && !Number.isNaN(Number(num));
}
function safeMin() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  return Math.min.apply(Math, args.filter(isValidNumber));
}
function safeMax() {
  var args = [];
  for (var _i = 0; _i < arguments.length; _i++) {
    args[_i] = arguments[_i];
  }
  return Math.max.apply(Math, args.filter(isValidNumber));
}
var __assign$4 = function() {
  __assign$4 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$4.apply(this, arguments);
};
var __rest$3 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function DayInput(_a2) {
  var maxDate = _a2.maxDate, minDate = _a2.minDate, month = _a2.month, year = _a2.year, otherProps = __rest$3(_a2, ["maxDate", "minDate", "month", "year"]);
  var currentMonthMaxDays = function() {
    if (!month) {
      return 31;
    }
    return getDaysInMonth(new Date(Number(year), Number(month) - 1, 1));
  }();
  function isSameMonth(date) {
    return year === getYear(date).toString() && month === getMonthHuman(date).toString();
  }
  var maxDay = safeMin(currentMonthMaxDays, maxDate && isSameMonth(maxDate) && getDate(maxDate));
  var minDay = safeMax(1, minDate && isSameMonth(minDate) && getDate(minDate));
  return u$1(Input, __assign$4({ max: maxDay, min: minDay, name: "day" }, otherProps));
}
var __assign$3 = function() {
  __assign$3 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$3.apply(this, arguments);
};
var __rest$2 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function MonthInput(_a2) {
  var maxDate = _a2.maxDate, minDate = _a2.minDate, year = _a2.year, otherProps = __rest$2(_a2, ["maxDate", "minDate", "year"]);
  function isSameYear(date) {
    return date && year === getYear(date).toString();
  }
  var maxMonth = safeMin(12, maxDate && isSameYear(maxDate) && getMonthHuman(maxDate));
  var minMonth = safeMax(1, minDate && isSameYear(minDate) && getMonthHuman(minDate));
  return u$1(Input, __assign$3({ max: maxMonth, min: minMonth, name: "month" }, otherProps));
}
var formatterCache = /* @__PURE__ */ new Map();
function getFormatter(options2) {
  return function formatter(locale, date) {
    var localeWithDefault = locale || getUserLocale();
    if (!formatterCache.has(localeWithDefault)) {
      formatterCache.set(localeWithDefault, /* @__PURE__ */ new Map());
    }
    var formatterCacheLocale = formatterCache.get(localeWithDefault);
    if (!formatterCacheLocale.has(options2)) {
      formatterCacheLocale.set(options2, new Intl.DateTimeFormat(localeWithDefault || void 0, options2).format);
    }
    return formatterCacheLocale.get(options2)(date);
  };
}
function toSafeHour(date) {
  var safeDate = new Date(date);
  return new Date(safeDate.setHours(12));
}
function getSafeFormatter(options2) {
  return function(locale, date) {
    return getFormatter(options2)(locale, toSafeHour(date));
  };
}
var formatMonthOptions = { month: "long" };
var formatShortMonthOptions = { month: "short" };
var formatMonth = getSafeFormatter(formatMonthOptions);
var formatShortMonth = getSafeFormatter(formatShortMonthOptions);
var __spreadArray$1 = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
    if (ar || !(i2 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
      ar[i2] = from[i2];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
function MonthSelect(_a2) {
  var ariaLabel = _a2.ariaLabel, autoFocus = _a2.autoFocus, className2 = _a2.className, disabled = _a2.disabled, inputRef = _a2.inputRef, locale = _a2.locale, maxDate = _a2.maxDate, minDate = _a2.minDate, onChange = _a2.onChange, onKeyDown = _a2.onKeyDown, _b = _a2.placeholder, placeholder = _b === void 0 ? "--" : _b, required = _a2.required, short = _a2.short, value = _a2.value, year = _a2.year;
  function isSameYear(date) {
    return date && year === getYear(date).toString();
  }
  var maxMonth = safeMin(12, maxDate && isSameYear(maxDate) && getMonthHuman(maxDate));
  var minMonth = safeMax(1, minDate && isSameYear(minDate) && getMonthHuman(minDate));
  var dates = __spreadArray$1([], Array(12), true).map(function(el, index) {
    return new Date(2019, index, 1);
  });
  var name = "month";
  var formatter = short ? formatShortMonth : formatMonth;
  return u$1("select", {
    "aria-label": ariaLabel,
    autoFocus,
    className: clsx("".concat(className2, "__input"), "".concat(className2, "__").concat(name)),
    "data-input": "true",
    "data-select": "true",
    disabled,
    name,
    onChange,
    onKeyDown,
    // Assertion is needed for React 18 compatibility
    ref: inputRef,
    required,
    value: value !== null ? value : "",
    children: [!value && u$1("option", { value: "", children: placeholder }), dates.map(function(date) {
      var month = getMonthHuman(date);
      var disabled2 = month < minMonth || month > maxMonth;
      return u$1("option", { disabled: disabled2, value: month, children: formatter(locale, date) }, month);
    })]
  });
}
var __assign$2 = function() {
  __assign$2 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$2.apply(this, arguments);
};
var __rest$1 = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
function YearInput(_a2) {
  var maxDate = _a2.maxDate, minDate = _a2.minDate, _b = _a2.placeholder, placeholder = _b === void 0 ? "----" : _b, valueType = _a2.valueType, otherProps = __rest$1(_a2, ["maxDate", "minDate", "placeholder", "valueType"]);
  var maxYear = safeMin(275760, maxDate && getYear(maxDate));
  var minYear = safeMax(1, minDate && getYear(minDate));
  var yearStep = function() {
    if (valueType === "century") {
      return 10;
    }
    return 1;
  }();
  return u$1(Input, __assign$2({ max: maxYear, min: minYear, name: "year", placeholder, step: yearStep }, otherProps));
}
function NativeInput(_a2) {
  var ariaLabel = _a2.ariaLabel, disabled = _a2.disabled, maxDate = _a2.maxDate, minDate = _a2.minDate, name = _a2.name, onChange = _a2.onChange, required = _a2.required, value = _a2.value, valueType = _a2.valueType;
  var nativeInputType = function() {
    switch (valueType) {
      case "decade":
      case "year":
        return "number";
      case "month":
        return "month";
      case "day":
        return "date";
      default:
        throw new Error("Invalid valueType");
    }
  }();
  var nativeValueParser = function() {
    switch (valueType) {
      case "decade":
      case "year":
        return getYear;
      case "month":
        return getISOLocalMonth;
      case "day":
        return getISOLocalDate;
      default:
        throw new Error("Invalid valueType");
    }
  }();
  function stopPropagation(event) {
    event.stopPropagation();
  }
  return u$1("input", { "aria-label": ariaLabel, disabled, hidden: true, max: maxDate ? nativeValueParser(maxDate) : void 0, min: minDate ? nativeValueParser(minDate) : void 0, name, onChange, onFocus: stopPropagation, required, style: {
    visibility: "hidden",
    position: "absolute",
    zIndex: "-999"
  }, type: nativeInputType, value: value ? nativeValueParser(value) : "" });
}
function getBegin(rangeType, date) {
  switch (rangeType) {
    case "decade":
      return getDecadeStart(date);
    case "year":
      return getYearStart(date);
    case "month":
      return getMonthStart(date);
    case "day":
      return getDayStart(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
function getEnd(rangeType, date) {
  switch (rangeType) {
    case "decade":
      return getDecadeEnd(date);
    case "year":
      return getYearEnd(date);
    case "month":
      return getMonthEnd(date);
    case "day":
      return getDayEnd(date);
    default:
      throw new Error("Invalid rangeType: ".concat(rangeType));
  }
}
var __assign$1 = function() {
  __assign$1 = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign$1.apply(this, arguments);
};
var __spreadArray = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i2 = 0, l2 = from.length, ar; i2 < l2; i2++) {
    if (ar || !(i2 in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i2);
      ar[i2] = from[i2];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
var getFormatterOptionsCache = {};
var defaultMinDate = /* @__PURE__ */ new Date();
defaultMinDate.setFullYear(1, 0, 1);
defaultMinDate.setHours(0, 0, 0, 0);
var defaultMaxDate = /* @__PURE__ */ new Date(864e13);
var allViews = ["century", "decade", "year", "month"];
var allValueTypes = __spreadArray(__spreadArray([], allViews.slice(1), true), ["day"], false);
function toDate(value) {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
}
function getValueType(view) {
  var index = allViews.indexOf(view);
  return allValueTypes[index];
}
function getValue(value, index) {
  var rawValue = Array.isArray(value) ? value[index] : value;
  if (!rawValue) {
    return null;
  }
  var valueDate = toDate(rawValue);
  if (isNaN(valueDate.getTime())) {
    throw new Error("Invalid date: ".concat(value));
  }
  return valueDate;
}
function getDetailValue(_a2, index) {
  var value = _a2.value, minDate = _a2.minDate, maxDate = _a2.maxDate, maxDetail = _a2.maxDetail;
  var valuePiece = getValue(value, index);
  if (!valuePiece) {
    return null;
  }
  var valueType = getValueType(maxDetail);
  var detailValueFrom = function() {
    switch (index) {
      case 0:
        return getBegin(valueType, valuePiece);
      case 1:
        return getEnd(valueType, valuePiece);
      default:
        throw new Error("Invalid index value: ".concat(index));
    }
  }();
  return between(detailValueFrom, minDate, maxDate);
}
var getDetailValueFrom = function(args) {
  return getDetailValue(args, 0);
};
var getDetailValueTo = function(args) {
  return getDetailValue(args, 1);
};
var getDetailValueArray = function(args) {
  return [getDetailValueFrom, getDetailValueTo].map(function(fn2) {
    return fn2(args);
  });
};
function isInternalInput(element) {
  return element.dataset.input === "true";
}
function findInput(element, property) {
  var nextElement = element;
  do {
    nextElement = nextElement[property];
  } while (nextElement && !isInternalInput(nextElement));
  return nextElement;
}
function focus(element) {
  if (element) {
    element.focus();
  }
}
function renderCustomInputs(placeholder, elementFunctions, allowMultipleInstances) {
  var usedFunctions = [];
  var pattern = new RegExp(Object.keys(elementFunctions).map(function(el) {
    return "".concat(el, "+");
  }).join("|"), "g");
  var matches = placeholder.match(pattern);
  return placeholder.split(pattern).reduce(function(arr, element, index) {
    var divider = element && // eslint-disable-next-line react/no-array-index-key
    u$1(Divider, { children: element }, "separator_".concat(index));
    arr.push(divider);
    var currentMatch = matches && matches[index];
    if (currentMatch) {
      var renderFunction = elementFunctions[currentMatch] || elementFunctions[Object.keys(elementFunctions).find(function(elementFunction) {
        return currentMatch.match(elementFunction);
      })];
      if (!renderFunction) {
        return arr;
      }
      if (!allowMultipleInstances && usedFunctions.includes(renderFunction)) {
        arr.push(currentMatch);
      } else {
        arr.push(renderFunction(currentMatch, index));
        usedFunctions.push(renderFunction);
      }
    }
    return arr;
  }, []);
}
function DateInput(_a2) {
  var autoFocus = _a2.autoFocus, className2 = _a2.className, dayAriaLabel = _a2.dayAriaLabel, dayPlaceholder = _a2.dayPlaceholder, disabled = _a2.disabled, format = _a2.format, _b = _a2.isCalendarOpen, isCalendarOpenProps = _b === void 0 ? null : _b, locale = _a2.locale, maxDate = _a2.maxDate, _c = _a2.maxDetail, maxDetail = _c === void 0 ? "month" : _c, minDate = _a2.minDate, monthAriaLabel = _a2.monthAriaLabel, monthPlaceholder = _a2.monthPlaceholder, _d = _a2.name, name = _d === void 0 ? "date" : _d, nativeInputAriaLabel = _a2.nativeInputAriaLabel, onChangeProps = _a2.onChange, onInvalidChange = _a2.onInvalidChange, required = _a2.required, _e = _a2.returnValue, returnValue = _e === void 0 ? "start" : _e, showLeadingZeros = _a2.showLeadingZeros, valueProps = _a2.value, yearAriaLabel = _a2.yearAriaLabel, yearPlaceholder = _a2.yearPlaceholder;
  var _f = h(null), year = _f[0], setYear = _f[1];
  var _g = h(null), month = _g[0], setMonth = _g[1];
  var _h = h(null), day = _h[0], setDay = _h[1];
  var _j = h(null), value = _j[0], setValue = _j[1];
  var yearInput = A$1(null);
  var monthInput = A$1(null);
  var monthSelect = A$1(null);
  var dayInput = A$1(null);
  var _k = h(isCalendarOpenProps), isCalendarOpen = _k[0], setIsCalendarOpen = _k[1];
  var lastPressedKey = A$1(void 0);
  y(function() {
    setIsCalendarOpen(isCalendarOpenProps);
  }, [isCalendarOpenProps]);
  y(function() {
    var nextValue = getDetailValueFrom({
      value: valueProps,
      minDate,
      maxDate,
      maxDetail
    });
    if (nextValue) {
      setYear(getYear(nextValue).toString());
      setMonth(getMonthHuman(nextValue).toString());
      setDay(getDate(nextValue).toString());
      setValue(nextValue);
    } else {
      setYear(null);
      setMonth(null);
      setDay(null);
      setValue(null);
    }
  }, [
    valueProps,
    minDate,
    maxDate,
    maxDetail,
    // Toggling calendar visibility resets values
    isCalendarOpen
  ]);
  var valueType = getValueType(maxDetail);
  var formatDate = function() {
    var level = allViews.indexOf(maxDetail);
    var formatterOptions = getFormatterOptionsCache[level] || function() {
      var options2 = { year: "numeric" };
      if (level >= 2) {
        options2.month = "numeric";
      }
      if (level >= 3) {
        options2.day = "numeric";
      }
      getFormatterOptionsCache[level] = options2;
      return options2;
    }();
    return getFormatter(formatterOptions);
  }();
  function getProcessedValue(value2) {
    var processFunction = function() {
      switch (returnValue) {
        case "start":
          return getDetailValueFrom;
        case "end":
          return getDetailValueTo;
        case "range":
          return getDetailValueArray;
        default:
          throw new Error("Invalid returnValue.");
      }
    }();
    return processFunction({
      value: value2,
      minDate,
      maxDate,
      maxDetail
    });
  }
  var placeholder = format || function() {
    var year2 = 2017;
    var monthIndex = 11;
    var day2 = 11;
    var date = new Date(year2, monthIndex, day2);
    var formattedDate = formatDate(locale, date);
    var datePieces = ["year", "month", "day"];
    var datePieceReplacements = ["y", "M", "d"];
    function formatDatePiece(name2, dateToFormat) {
      var formatterOptions = getFormatterOptionsCache[name2] || function() {
        var _a3;
        var options2 = (_a3 = {}, _a3[name2] = "numeric", _a3);
        getFormatterOptionsCache[name2] = options2;
        return options2;
      }();
      return getFormatter(formatterOptions)(locale, dateToFormat).match(/\d{1,}/);
    }
    var placeholder2 = formattedDate;
    datePieces.forEach(function(datePiece, index) {
      var match = formatDatePiece(datePiece, date);
      if (match) {
        var formattedDatePiece = match[0];
        var datePieceReplacement = datePieceReplacements[index];
        placeholder2 = placeholder2.replace(formattedDatePiece, datePieceReplacement);
      }
    });
    placeholder2 = placeholder2.replace("17", "y");
    return placeholder2;
  }();
  var divider = function() {
    var dividers = placeholder.match(/[^0-9a-z]/i);
    return dividers ? dividers[0] : null;
  }();
  function onClick(event) {
    if (event.target === event.currentTarget) {
      var firstInput = event.target.children[1];
      focus(firstInput);
    }
  }
  function onKeyDown(event) {
    lastPressedKey.current = event.key;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
      case divider: {
        event.preventDefault();
        var input = event.target;
        var property = event.key === "ArrowLeft" ? "previousElementSibling" : "nextElementSibling";
        var nextInput = findInput(input, property);
        focus(nextInput);
        break;
      }
    }
  }
  function onKeyUp(event) {
    var key = event.key, input = event.target;
    var isLastPressedKey = lastPressedKey.current === key;
    if (!isLastPressedKey) {
      return;
    }
    var isNumberKey = !isNaN(Number(key));
    if (!isNumberKey) {
      return;
    }
    var max = input.getAttribute("max");
    if (!max) {
      return;
    }
    var value2 = input.value;
    if (Number(value2) * 10 > Number(max) || value2.length >= max.length) {
      var property = "nextElementSibling";
      var nextInput = findInput(input, property);
      focus(nextInput);
    }
  }
  function onChangeExternal() {
    if (!onChangeProps) {
      return;
    }
    function filterBoolean(value2) {
      return Boolean(value2);
    }
    var formElements = [
      dayInput.current,
      monthInput.current,
      monthSelect.current,
      yearInput.current
    ].filter(filterBoolean);
    var values = {};
    formElements.forEach(function(formElement) {
      values[formElement.name] = "valueAsNumber" in formElement ? formElement.valueAsNumber : Number(formElement.value);
    });
    var isEveryValueEmpty = formElements.every(function(formElement) {
      return !formElement.value;
    });
    if (isEveryValueEmpty) {
      onChangeProps(null, false);
      return;
    }
    var isEveryValueFilled = formElements.every(function(formElement) {
      return formElement.value;
    });
    var isEveryValueValid = formElements.every(function(formElement) {
      return formElement.validity.valid;
    });
    if (isEveryValueFilled && isEveryValueValid) {
      var year_1 = Number(values.year || (/* @__PURE__ */ new Date()).getFullYear());
      var monthIndex = Number(values.month || 1) - 1;
      var day_1 = Number(values.day || 1);
      var proposedValue = /* @__PURE__ */ new Date();
      proposedValue.setFullYear(year_1, monthIndex, day_1);
      proposedValue.setHours(0, 0, 0, 0);
      var processedValue = getProcessedValue(proposedValue);
      onChangeProps(processedValue, false);
      return;
    }
    if (!onInvalidChange) {
      return;
    }
    onInvalidChange();
  }
  function onChange(event) {
    var _a3 = event.target, name2 = _a3.name, value2 = _a3.value;
    switch (name2) {
      case "year":
        setYear(value2);
        break;
      case "month":
        setMonth(value2);
        break;
      case "day":
        setDay(value2);
        break;
    }
    onChangeExternal();
  }
  function onChangeNative(event) {
    var value2 = event.target.value;
    if (!onChangeProps) {
      return;
    }
    var processedValue = function() {
      if (!value2) {
        return null;
      }
      var _a3 = value2.split("-"), yearString = _a3[0], monthString = _a3[1], dayString = _a3[2];
      var year2 = Number(yearString);
      var monthIndex = Number(monthString) - 1 || 0;
      var day2 = Number(dayString) || 1;
      var proposedValue = /* @__PURE__ */ new Date();
      proposedValue.setFullYear(year2, monthIndex, day2);
      proposedValue.setHours(0, 0, 0, 0);
      return proposedValue;
    }();
    onChangeProps(processedValue, false);
  }
  var commonInputProps = {
    className: className2,
    disabled,
    maxDate: maxDate || defaultMaxDate,
    minDate: minDate || defaultMinDate,
    onChange,
    onKeyDown,
    onKeyUp,
    // This is only for showing validity when editing
    required: Boolean(required || isCalendarOpen)
  };
  function renderDay(currentMatch, index) {
    if (currentMatch && currentMatch.length > 2) {
      throw new Error("Unsupported token: ".concat(currentMatch));
    }
    var showLeadingZerosFromFormat = currentMatch && currentMatch.length === 2;
    return u$1(DayInput, __assign$1({}, commonInputProps, {
      ariaLabel: dayAriaLabel,
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus: index === 0 && autoFocus,
      inputRef: dayInput,
      month,
      placeholder: dayPlaceholder,
      showLeadingZeros: showLeadingZerosFromFormat || showLeadingZeros,
      value: day,
      year
    }), "day");
  }
  function renderMonth(currentMatch, index) {
    if (currentMatch && currentMatch.length > 4) {
      throw new Error("Unsupported token: ".concat(currentMatch));
    }
    if (currentMatch.length > 2) {
      return u$1(MonthSelect, __assign$1({}, commonInputProps, {
        ariaLabel: monthAriaLabel,
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus: index === 0 && autoFocus,
        inputRef: monthSelect,
        locale,
        placeholder: monthPlaceholder,
        short: currentMatch.length === 3,
        value: month,
        year
      }), "month");
    }
    var showLeadingZerosFromFormat = currentMatch && currentMatch.length === 2;
    return u$1(MonthInput, __assign$1({}, commonInputProps, {
      ariaLabel: monthAriaLabel,
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus: index === 0 && autoFocus,
      inputRef: monthInput,
      placeholder: monthPlaceholder,
      showLeadingZeros: showLeadingZerosFromFormat || showLeadingZeros,
      value: month,
      year
    }), "month");
  }
  function renderYear(currentMatch, index) {
    return u$1(YearInput, __assign$1({}, commonInputProps, {
      ariaLabel: yearAriaLabel,
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus: index === 0 && autoFocus,
      inputRef: yearInput,
      placeholder: yearPlaceholder,
      value: year,
      valueType
    }), "year");
  }
  function renderCustomInputsInternal() {
    var elementFunctions = {
      d: renderDay,
      M: renderMonth,
      y: renderYear
    };
    var allowMultipleInstances = typeof format !== "undefined";
    return renderCustomInputs(placeholder, elementFunctions, allowMultipleInstances);
  }
  function renderNativeInput() {
    return u$1(NativeInput, { ariaLabel: nativeInputAriaLabel, disabled, maxDate: maxDate || defaultMaxDate, minDate: minDate || defaultMinDate, name, onChange: onChangeNative, required, value, valueType }, "date");
  }
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    u$1("div", { className: className2, onClick, children: [renderNativeInput(), renderCustomInputsInternal()] })
  );
}
var __assign = function() {
  __assign = Object.assign || function(t2) {
    for (var s2, i2 = 1, n2 = arguments.length; i2 < n2; i2++) {
      s2 = arguments[i2];
      for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2))
        t2[p2] = s2[p2];
    }
    return t2;
  };
  return __assign.apply(this, arguments);
};
var __rest = function(s2, e2) {
  var t2 = {};
  for (var p2 in s2) if (Object.prototype.hasOwnProperty.call(s2, p2) && e2.indexOf(p2) < 0)
    t2[p2] = s2[p2];
  if (s2 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i2 = 0, p2 = Object.getOwnPropertySymbols(s2); i2 < p2.length; i2++) {
      if (e2.indexOf(p2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(s2, p2[i2]))
        t2[p2[i2]] = s2[p2[i2]];
    }
  return t2;
};
var baseClassName = "react-date-picker";
var outsideActionEvents = ["mousedown", "focusin", "touchstart"];
var iconProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 19,
  height: 19,
  viewBox: "0 0 19 19",
  stroke: "black",
  strokeWidth: 2
};
var CalendarIcon$1 = u$1("svg", __assign({}, iconProps, { className: "".concat(baseClassName, "__calendar-button__icon ").concat(baseClassName, "__button__icon"), children: [u$1("rect", { fill: "none", height: "15", width: "15", x: "2", y: "2" }), u$1("line", { x1: "6", x2: "6", y1: "0", y2: "4" }), u$1("line", { x1: "13", x2: "13", y1: "0", y2: "4" })] }));
var ClearIcon = u$1("svg", __assign({}, iconProps, { className: "".concat(baseClassName, "__clear-button__icon ").concat(baseClassName, "__button__icon"), children: [u$1("line", { x1: "4", x2: "15", y1: "4", y2: "15" }), u$1("line", { x1: "15", x2: "4", y1: "4", y2: "15" })] }));
function DatePicker(props) {
  var autoFocus = props.autoFocus, calendarAriaLabel = props.calendarAriaLabel, _a2 = props.calendarIcon, calendarIcon = _a2 === void 0 ? CalendarIcon$1 : _a2, className2 = props.className, clearAriaLabel = props.clearAriaLabel, _b = props.clearIcon, clearIcon = _b === void 0 ? ClearIcon : _b, _c = props.closeCalendar, shouldCloseCalendarOnSelect = _c === void 0 ? true : _c, dataTestid = props["data-testid"], dayAriaLabel = props.dayAriaLabel, dayPlaceholder = props.dayPlaceholder, disableCalendar = props.disableCalendar, disabled = props.disabled, format = props.format, id = props.id, _d = props.isOpen, isOpenProps = _d === void 0 ? null : _d, locale = props.locale, maxDate = props.maxDate, _e = props.maxDetail, maxDetail = _e === void 0 ? "month" : _e, minDate = props.minDate, monthAriaLabel = props.monthAriaLabel, monthPlaceholder = props.monthPlaceholder, _f = props.name, name = _f === void 0 ? "date" : _f, nativeInputAriaLabel = props.nativeInputAriaLabel, onCalendarClose = props.onCalendarClose, onCalendarOpen = props.onCalendarOpen, onChangeProps = props.onChange, onFocusProps = props.onFocus, onInvalidChange = props.onInvalidChange, _g = props.openCalendarOnFocus, openCalendarOnFocus = _g === void 0 ? true : _g, required = props.required, _h = props.returnValue, returnValue = _h === void 0 ? "start" : _h, shouldCloseCalendar = props.shouldCloseCalendar, shouldOpenCalendar = props.shouldOpenCalendar, showLeadingZeros = props.showLeadingZeros, value = props.value, yearAriaLabel = props.yearAriaLabel, yearPlaceholder = props.yearPlaceholder, otherProps = __rest(props, ["autoFocus", "calendarAriaLabel", "calendarIcon", "className", "clearAriaLabel", "clearIcon", "closeCalendar", "data-testid", "dayAriaLabel", "dayPlaceholder", "disableCalendar", "disabled", "format", "id", "isOpen", "locale", "maxDate", "maxDetail", "minDate", "monthAriaLabel", "monthPlaceholder", "name", "nativeInputAriaLabel", "onCalendarClose", "onCalendarOpen", "onChange", "onFocus", "onInvalidChange", "openCalendarOnFocus", "required", "returnValue", "shouldCloseCalendar", "shouldOpenCalendar", "showLeadingZeros", "value", "yearAriaLabel", "yearPlaceholder"]);
  var _j = h(isOpenProps), isOpen = _j[0], setIsOpen = _j[1];
  var wrapper = A$1(null);
  var calendarWrapper = A$1(null);
  y(function() {
    setIsOpen(isOpenProps);
  }, [isOpenProps]);
  function openCalendar(_a3) {
    var reason = _a3.reason;
    if (shouldOpenCalendar) {
      if (!shouldOpenCalendar({ reason })) {
        return;
      }
    }
    setIsOpen(true);
    if (onCalendarOpen) {
      onCalendarOpen();
    }
  }
  var closeCalendar = q(function(_a3) {
    var reason = _a3.reason;
    if (shouldCloseCalendar) {
      if (!shouldCloseCalendar({ reason })) {
        return;
      }
    }
    setIsOpen(false);
    if (onCalendarClose) {
      onCalendarClose();
    }
  }, [onCalendarClose, shouldCloseCalendar]);
  function toggleCalendar() {
    if (isOpen) {
      closeCalendar({ reason: "buttonClick" });
    } else {
      openCalendar({ reason: "buttonClick" });
    }
  }
  function onChange(value2, shouldCloseCalendar2) {
    if (shouldCloseCalendar2 === void 0) {
      shouldCloseCalendar2 = shouldCloseCalendarOnSelect;
    }
    if (shouldCloseCalendar2) {
      closeCalendar({ reason: "select" });
    }
    if (onChangeProps) {
      onChangeProps(value2);
    }
  }
  function onFocus2(event) {
    if (onFocusProps) {
      onFocusProps(event);
    }
    if (
      // Internet Explorer still fires onFocus on disabled elements
      disabled || isOpen || !openCalendarOnFocus || event.target.dataset.select === "true"
    ) {
      return;
    }
    openCalendar({ reason: "focus" });
  }
  var onKeyDown = q(function(event) {
    if (event.key === "Escape") {
      closeCalendar({ reason: "escape" });
    }
  }, [closeCalendar]);
  function clear() {
    onChange(null);
  }
  function stopPropagation(event) {
    event.stopPropagation();
  }
  var onOutsideAction = q(function(event) {
    var wrapperEl = wrapper.current;
    var calendarWrapperEl = calendarWrapper.current;
    var target2 = "composedPath" in event ? event.composedPath()[0] : event.target;
    if (target2 && wrapperEl && !wrapperEl.contains(target2) && (!calendarWrapperEl || !calendarWrapperEl.contains(target2))) {
      closeCalendar({ reason: "outsideAction" });
    }
  }, [calendarWrapper, closeCalendar, wrapper]);
  var handleOutsideActionListeners = q(function(shouldListen) {
    if (shouldListen === void 0) {
      shouldListen = isOpen;
    }
    outsideActionEvents.forEach(function(event) {
      if (shouldListen) {
        document.addEventListener(event, onOutsideAction);
      } else {
        document.removeEventListener(event, onOutsideAction);
      }
    });
    if (shouldListen) {
      document.addEventListener("keydown", onKeyDown);
    } else {
      document.removeEventListener("keydown", onKeyDown);
    }
  }, [isOpen, onOutsideAction, onKeyDown]);
  y(function() {
    handleOutsideActionListeners();
    return function() {
      handleOutsideActionListeners(false);
    };
  }, [handleOutsideActionListeners]);
  function renderInputs() {
    var valueFrom = (Array.isArray(value) ? value : [value])[0];
    var ariaLabelProps = {
      dayAriaLabel,
      monthAriaLabel,
      nativeInputAriaLabel,
      yearAriaLabel
    };
    var placeholderProps = {
      dayPlaceholder,
      monthPlaceholder,
      yearPlaceholder
    };
    return u$1("div", { className: "".concat(baseClassName, "__wrapper"), children: [u$1(DateInput, __assign({}, ariaLabelProps, placeholderProps, {
      // eslint-disable-next-line jsx-a11y/no-autofocus
      autoFocus,
      className: "".concat(baseClassName, "__inputGroup"),
      disabled,
      format,
      isCalendarOpen: isOpen,
      locale,
      maxDate,
      maxDetail,
      minDate,
      name,
      onChange,
      onInvalidChange,
      required,
      returnValue,
      showLeadingZeros,
      value: valueFrom
    })), clearIcon !== null && u$1("button", { "aria-label": clearAriaLabel, className: "".concat(baseClassName, "__clear-button ").concat(baseClassName, "__button"), disabled, onClick: clear, onFocus: stopPropagation, type: "button", children: typeof clearIcon === "function" ? _$1(clearIcon) : clearIcon }), calendarIcon !== null && !disableCalendar && u$1("button", { "aria-expanded": isOpen || false, "aria-label": calendarAriaLabel, className: "".concat(baseClassName, "__calendar-button ").concat(baseClassName, "__button"), disabled, onClick: toggleCalendar, onFocus: stopPropagation, type: "button", children: typeof calendarIcon === "function" ? _$1(calendarIcon) : calendarIcon })] });
  }
  function renderCalendar() {
    if (isOpen === null || disableCalendar) {
      return null;
    }
    var calendarProps = props.calendarProps, portalContainer = props.portalContainer, value2 = props.value;
    var className3 = "".concat(baseClassName, "__calendar");
    var classNames = clsx(className3, "".concat(className3, "--").concat(isOpen ? "open" : "closed"));
    var calendar = u$1(Calendar, __assign({ locale, maxDate, maxDetail, minDate, onChange: function(value3) {
      return onChange(value3);
    }, value: value2 }, calendarProps));
    return portalContainer ? j(u$1("div", { ref: calendarWrapper, className: classNames, children: calendar }), portalContainer) : u$1(Fit, { children: u$1("div", { ref: function(ref) {
      if (ref && !isOpen) {
        ref.removeAttribute("style");
      }
    }, className: classNames, children: calendar }) });
  }
  var eventProps = T$1(function() {
    return makeEventProps(otherProps);
  }, [otherProps]);
  return u$1("div", __assign({ className: clsx(baseClassName, "".concat(baseClassName, "--").concat(isOpen ? "open" : "closed"), "".concat(baseClassName, "--").concat(disabled ? "disabled" : "enabled"), className2), "data-testid": dataTestid, id }, eventProps, { onFocus: onFocus2, ref: wrapper, children: [renderInputs(), renderCalendar()] }));
}
const CalendarIcon = () => /* @__PURE__ */ u$1(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    class: "lucide lucide-calendar-days",
    children: [
      /* @__PURE__ */ u$1("path", { d: "M8 2v4" }),
      /* @__PURE__ */ u$1("path", { d: "M16 2v4" }),
      /* @__PURE__ */ u$1("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }),
      /* @__PURE__ */ u$1("path", { d: "M3 10h18" }),
      /* @__PURE__ */ u$1("path", { d: "M8 14h.01" }),
      /* @__PURE__ */ u$1("path", { d: "M12 14h.01" }),
      /* @__PURE__ */ u$1("path", { d: "M16 14h.01" }),
      /* @__PURE__ */ u$1("path", { d: "M8 18h.01" }),
      /* @__PURE__ */ u$1("path", { d: "M12 18h.01" }),
      /* @__PURE__ */ u$1("path", { d: "M16 18h.01" })
    ]
  }
);
const CalendarCheckIcon = () => /* @__PURE__ */ u$1(
  "svg",
  {
    xmlns: "http://www.w3.org/2000/svg",
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    class: "lucide lucide-calendar-check",
    children: [
      /* @__PURE__ */ u$1("path", { d: "M8 2v4" }),
      /* @__PURE__ */ u$1("path", { d: "M16 2v4" }),
      /* @__PURE__ */ u$1("rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }),
      /* @__PURE__ */ u$1("path", { d: "M3 10h18" }),
      /* @__PURE__ */ u$1("path", { d: "m9 16 2 2 4-4" })
    ]
  }
);
const DateQuestion = ({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  onChange,
  languageCode,
  setTtc,
  ttc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const [errorMessage, setErrorMessage] = h("");
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const [datePickerOpen, setDatePickerOpen] = h(false);
  const [selectedDate, setSelectedDate] = h(value ? new Date(value) : void 0);
  const [hideInvalid, setHideInvalid] = h(!selectedDate);
  y(() => {
    if (datePickerOpen) {
      if (!selectedDate) setSelectedDate(/* @__PURE__ */ new Date());
      const input = document.querySelector(".react-date-picker__inputGroup__input");
      if (input) {
        input.focus();
      }
    }
  }, [datePickerOpen, selectedDate]);
  y(() => {
    if (!!selectedDate) {
      if (hideInvalid) {
        setHideInvalid(false);
      }
    }
  }, [selectedDate]);
  const formattedDate = T$1(() => {
    if (!selectedDate) return "";
    const day = selectedDate.getDate();
    const monthIndex = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    return `${getOrdinalDate(day)} of ${getMonthName(monthIndex)}, ${year}`;
  }, [selectedDate]);
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        if (question.required && !value) {
          setErrorMessage("Please select a date.");
          return;
        }
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-text-red-600", children: /* @__PURE__ */ u$1("span", { children: errorMessage }) }),
          /* @__PURE__ */ u$1(
            "div",
            {
              className: cn("fb-mt-4 fb-w-full", errorMessage && "fb-rounded-lg fb-border-2 fb-border-red-500"),
              id: "date-picker-root",
              children: /* @__PURE__ */ u$1("div", { className: "fb-relative", children: [
                !datePickerOpen && /* @__PURE__ */ u$1(
                  "div",
                  {
                    onClick: () => setDatePickerOpen(true),
                    tabIndex: 0,
                    onKeyDown: (e2) => {
                      if (e2.key === " ") setDatePickerOpen(true);
                    },
                    className: "focus:fb-outline-brand fb-bg-input-bg hover:fb-bg-input-bg-selected fb-border-border fb-text-heading fb-rounded-custom fb-relative fb-flex fb-h-[12dvh] fb-w-full fb-cursor-pointer fb-appearance-none fb-items-center fb-justify-center fb-border fb-text-left fb-text-base fb-font-normal",
                    children: /* @__PURE__ */ u$1("div", { className: "fb-flex fb-items-center fb-gap-2", children: selectedDate ? /* @__PURE__ */ u$1("div", { className: "fb-flex fb-items-center fb-gap-2", children: [
                      /* @__PURE__ */ u$1(CalendarCheckIcon, {}),
                      " ",
                      /* @__PURE__ */ u$1("span", { children: formattedDate })
                    ] }) : /* @__PURE__ */ u$1("div", { className: "fb-flex fb-items-center fb-gap-2", children: [
                      /* @__PURE__ */ u$1(CalendarIcon, {}),
                      " ",
                      /* @__PURE__ */ u$1("span", { children: "Select a date" })
                    ] }) })
                  }
                ),
                /* @__PURE__ */ u$1(
                  DatePicker,
                  {
                    value: selectedDate,
                    isOpen: datePickerOpen,
                    onChange: (value2) => {
                      const date = value2;
                      setSelectedDate(date);
                      const timezoneOffset = date.getTimezoneOffset() * 6e4;
                      const adjustedDate = new Date(date.getTime() - timezoneOffset);
                      const dateString = adjustedDate.toISOString().split("T")[0];
                      onChange({ [question.id]: dateString });
                    },
                    minDate: new Date((/* @__PURE__ */ new Date()).getFullYear() - 100, (/* @__PURE__ */ new Date()).getMonth(), (/* @__PURE__ */ new Date()).getDate()),
                    maxDate: /* @__PURE__ */ new Date("3000-12-31"),
                    dayPlaceholder: "DD",
                    monthPlaceholder: "MM",
                    yearPlaceholder: "YYYY",
                    format: question.format ?? "M-d-y",
                    className: `dp-input-root fb-rounded-custom wrapper-hide ${!datePickerOpen ? "" : "fb-h-[46dvh] sm:fb-h-[34dvh]"} ${hideInvalid ? "hide-invalid" : ""} `,
                    calendarClassName: "calendar-root !fb-bg-input-bg fb-border fb-border-border fb-rounded-custom fb-p-3 fb-h-[46dvh] sm:fb-h-[33dvh] fb-overflow-auto",
                    clearIcon: null,
                    onCalendarOpen: () => {
                      setDatePickerOpen(true);
                    },
                    onCalendarClose: () => {
                      setDatePickerOpen(false);
                      setSelectedDate(selectedDate);
                    },
                    calendarIcon: /* @__PURE__ */ u$1(CalendarIcon, {}),
                    tileClassName: ({ date }) => {
                      const baseClass = "hover:fb-bg-input-bg-selected fb-rounded-custom fb-h-9 fb-p-0 fb-mt-1 fb-font-normal fb-text-heading aria-selected:fb-opacity-100 focus:fb-ring-2 focus:fb-bg-slate-200";
                      if (date.getDate() === (/* @__PURE__ */ new Date()).getDate() && date.getMonth() === (/* @__PURE__ */ new Date()).getMonth() && date.getFullYear() === (/* @__PURE__ */ new Date()).getFullYear()) {
                        return `${baseClass} !fb-bg-brand !fb-border-border-highlight !fb-text-heading focus:fb-ring-2 focus:fb-bg-slate-200`;
                      }
                      if (date.getDate() === (selectedDate == null ? void 0 : selectedDate.getDate()) && date.getMonth() === (selectedDate == null ? void 0 : selectedDate.getMonth()) && date.getFullYear() === (selectedDate == null ? void 0 : selectedDate.getFullYear())) {
                        return `${baseClass} !fb-bg-brand !fb-border-border-highlight !fb-text-heading`;
                      }
                      return baseClass;
                    },
                    formatShortWeekday: (_2, date) => {
                      return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
                    },
                    showNeighboringMonth: false,
                    showLeadingZeros: false
                  },
                  datePickerOpen
                )
              ] })
            }
          )
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          /* @__PURE__ */ u$1("div", { children: !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ) }),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              isLastQuestion,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              tabIndex: 0
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const parents = /* @__PURE__ */ new Set();
const coords = /* @__PURE__ */ new WeakMap();
const siblings = /* @__PURE__ */ new WeakMap();
const animations = /* @__PURE__ */ new WeakMap();
const intersections = /* @__PURE__ */ new WeakMap();
const intervals = /* @__PURE__ */ new WeakMap();
const options = /* @__PURE__ */ new WeakMap();
const debounces = /* @__PURE__ */ new WeakMap();
const enabled = /* @__PURE__ */ new WeakSet();
let root;
let scrollX = 0;
let scrollY = 0;
const TGT = "__aa_tgt";
const DEL = "__aa_del";
const NEW = "__aa_new";
const handleMutations = (mutations2) => {
  const elements = getElements(mutations2);
  if (elements) {
    elements.forEach((el) => animate(el));
  }
};
const handleResizes = (entries) => {
  entries.forEach((entry) => {
    if (entry.target === root)
      updateAllPos();
    if (coords.has(entry.target))
      updatePos(entry.target);
  });
};
function observePosition(el) {
  const oldObserver = intersections.get(el);
  oldObserver === null || oldObserver === void 0 ? void 0 : oldObserver.disconnect();
  let rect = coords.get(el);
  let invocations = 0;
  const buffer = 5;
  if (!rect) {
    rect = getCoords(el);
    coords.set(el, rect);
  }
  const { offsetWidth, offsetHeight } = root;
  const rootMargins = [
    rect.top - buffer,
    offsetWidth - (rect.left + buffer + rect.width),
    offsetHeight - (rect.top + buffer + rect.height),
    rect.left - buffer
  ];
  const rootMargin = rootMargins.map((px) => `${-1 * Math.floor(px)}px`).join(" ");
  const observer = new IntersectionObserver(() => {
    ++invocations > 1 && updatePos(el);
  }, {
    root,
    threshold: 1,
    rootMargin
  });
  observer.observe(el);
  intersections.set(el, observer);
}
function updatePos(el) {
  clearTimeout(debounces.get(el));
  const optionsOrPlugin = getOptions(el);
  const delay = isPlugin(optionsOrPlugin) ? 500 : optionsOrPlugin.duration;
  debounces.set(el, setTimeout(async () => {
    const currentAnimation = animations.get(el);
    try {
      await (currentAnimation === null || currentAnimation === void 0 ? void 0 : currentAnimation.finished);
      coords.set(el, getCoords(el));
      observePosition(el);
    } catch {
    }
  }, delay));
}
function updateAllPos() {
  clearTimeout(debounces.get(root));
  debounces.set(root, setTimeout(() => {
    parents.forEach((parent) => forEach(parent, (el) => lowPriority(() => updatePos(el))));
  }, 100));
}
function poll(el) {
  setTimeout(() => {
    intervals.set(el, setInterval(() => lowPriority(updatePos.bind(null, el)), 2e3));
  }, Math.round(2e3 * Math.random()));
}
function lowPriority(callback) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => callback());
  } else {
    requestAnimationFrame(() => callback());
  }
}
let mutations;
let resize;
const supportedBrowser = typeof window !== "undefined" && "ResizeObserver" in window;
if (supportedBrowser) {
  root = document.documentElement;
  mutations = new MutationObserver(handleMutations);
  resize = new ResizeObserver(handleResizes);
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY;
    scrollX = window.scrollX;
  });
  resize.observe(root);
}
function getElements(mutations2) {
  const observedNodes = mutations2.reduce((nodes, mutation) => {
    return [
      ...nodes,
      ...Array.from(mutation.addedNodes),
      ...Array.from(mutation.removedNodes)
    ];
  }, []);
  const onlyCommentNodesObserved = observedNodes.every((node) => node.nodeName === "#comment");
  if (onlyCommentNodesObserved)
    return false;
  return mutations2.reduce((elements, mutation) => {
    if (elements === false)
      return false;
    if (mutation.target instanceof Element) {
      target(mutation.target);
      if (!elements.has(mutation.target)) {
        elements.add(mutation.target);
        for (let i2 = 0; i2 < mutation.target.children.length; i2++) {
          const child = mutation.target.children.item(i2);
          if (!child)
            continue;
          if (DEL in child) {
            return false;
          }
          target(mutation.target, child);
          elements.add(child);
        }
      }
      if (mutation.removedNodes.length) {
        for (let i2 = 0; i2 < mutation.removedNodes.length; i2++) {
          const child = mutation.removedNodes[i2];
          if (DEL in child) {
            return false;
          }
          if (child instanceof Element) {
            elements.add(child);
            target(mutation.target, child);
            siblings.set(child, [
              mutation.previousSibling,
              mutation.nextSibling
            ]);
          }
        }
      }
    }
    return elements;
  }, /* @__PURE__ */ new Set());
}
function target(el, child) {
  if (!child && !(TGT in el))
    Object.defineProperty(el, TGT, { value: el });
  else if (child && !(TGT in child))
    Object.defineProperty(child, TGT, { value: el });
}
function animate(el) {
  var _a2;
  const isMounted = el.isConnected;
  const preExisting = coords.has(el);
  if (isMounted && siblings.has(el))
    siblings.delete(el);
  if (animations.has(el)) {
    (_a2 = animations.get(el)) === null || _a2 === void 0 ? void 0 : _a2.cancel();
  }
  if (NEW in el) {
    add$1(el);
  } else if (preExisting && isMounted) {
    remain(el);
  } else if (preExisting && !isMounted) {
    remove(el);
  } else {
    add$1(el);
  }
}
function raw(str) {
  return Number(str.replace(/[^0-9.\-]/g, ""));
}
function getScrollOffset(el) {
  let p2 = el.parentElement;
  while (p2) {
    if (p2.scrollLeft || p2.scrollTop) {
      return { x: p2.scrollLeft, y: p2.scrollTop };
    }
    p2 = p2.parentElement;
  }
  return { x: 0, y: 0 };
}
function getCoords(el) {
  const rect = el.getBoundingClientRect();
  const { x: x2, y: y2 } = getScrollOffset(el);
  return {
    top: rect.top + y2,
    left: rect.left + x2,
    width: rect.width,
    height: rect.height
  };
}
function getTransitionSizes(el, oldCoords, newCoords) {
  let widthFrom = oldCoords.width;
  let heightFrom = oldCoords.height;
  let widthTo = newCoords.width;
  let heightTo = newCoords.height;
  const styles = getComputedStyle(el);
  const sizing = styles.getPropertyValue("box-sizing");
  if (sizing === "content-box") {
    const paddingY = raw(styles.paddingTop) + raw(styles.paddingBottom) + raw(styles.borderTopWidth) + raw(styles.borderBottomWidth);
    const paddingX = raw(styles.paddingLeft) + raw(styles.paddingRight) + raw(styles.borderRightWidth) + raw(styles.borderLeftWidth);
    widthFrom -= paddingX;
    widthTo -= paddingX;
    heightFrom -= paddingY;
    heightTo -= paddingY;
  }
  return [widthFrom, widthTo, heightFrom, heightTo].map(Math.round);
}
function getOptions(el) {
  return TGT in el && options.has(el[TGT]) ? options.get(el[TGT]) : { duration: 250, easing: "ease-in-out" };
}
function getTarget(el) {
  if (TGT in el)
    return el[TGT];
  return void 0;
}
function isEnabled(el) {
  const target2 = getTarget(el);
  return target2 ? enabled.has(target2) : false;
}
function forEach(parent, ...callbacks) {
  callbacks.forEach((callback) => callback(parent, options.has(parent)));
  for (let i2 = 0; i2 < parent.children.length; i2++) {
    const child = parent.children.item(i2);
    if (child) {
      callbacks.forEach((callback) => callback(child, options.has(child)));
    }
  }
}
function getPluginTuple(pluginReturn) {
  if (Array.isArray(pluginReturn))
    return pluginReturn;
  return [pluginReturn];
}
function isPlugin(config) {
  return typeof config === "function";
}
function remain(el) {
  const oldCoords = coords.get(el);
  const newCoords = getCoords(el);
  if (!isEnabled(el))
    return coords.set(el, newCoords);
  let animation;
  if (!oldCoords)
    return;
  const pluginOrOptions = getOptions(el);
  if (typeof pluginOrOptions !== "function") {
    const deltaX = oldCoords.left - newCoords.left;
    const deltaY = oldCoords.top - newCoords.top;
    const [widthFrom, widthTo, heightFrom, heightTo] = getTransitionSizes(el, oldCoords, newCoords);
    const start = {
      transform: `translate(${deltaX}px, ${deltaY}px)`
    };
    const end = {
      transform: `translate(0, 0)`
    };
    if (widthFrom !== widthTo) {
      start.width = `${widthFrom}px`;
      end.width = `${widthTo}px`;
    }
    if (heightFrom !== heightTo) {
      start.height = `${heightFrom}px`;
      end.height = `${heightTo}px`;
    }
    animation = el.animate([start, end], {
      duration: pluginOrOptions.duration,
      easing: pluginOrOptions.easing
    });
  } else {
    const [keyframes] = getPluginTuple(pluginOrOptions(el, "remain", oldCoords, newCoords));
    animation = new Animation(keyframes);
    animation.play();
  }
  animations.set(el, animation);
  coords.set(el, newCoords);
  animation.addEventListener("finish", updatePos.bind(null, el));
}
function add$1(el) {
  if (NEW in el)
    delete el[NEW];
  const newCoords = getCoords(el);
  coords.set(el, newCoords);
  const pluginOrOptions = getOptions(el);
  if (!isEnabled(el))
    return;
  let animation;
  if (typeof pluginOrOptions !== "function") {
    animation = el.animate([
      { transform: "scale(.98)", opacity: 0 },
      { transform: "scale(0.98)", opacity: 0, offset: 0.5 },
      { transform: "scale(1)", opacity: 1 }
    ], {
      duration: pluginOrOptions.duration * 1.5,
      easing: "ease-in"
    });
  } else {
    const [keyframes] = getPluginTuple(pluginOrOptions(el, "add", newCoords));
    animation = new Animation(keyframes);
    animation.play();
  }
  animations.set(el, animation);
  animation.addEventListener("finish", updatePos.bind(null, el));
}
function cleanUp(el, styles) {
  var _a2;
  el.remove();
  coords.delete(el);
  siblings.delete(el);
  animations.delete(el);
  (_a2 = intersections.get(el)) === null || _a2 === void 0 ? void 0 : _a2.disconnect();
  setTimeout(() => {
    if (DEL in el)
      delete el[DEL];
    Object.defineProperty(el, NEW, { value: true, configurable: true });
    if (styles && el instanceof HTMLElement) {
      for (const style in styles) {
        el.style[style] = "";
      }
    }
  }, 0);
}
function remove(el) {
  var _a2;
  if (!siblings.has(el) || !coords.has(el))
    return;
  const [prev, next] = siblings.get(el);
  Object.defineProperty(el, DEL, { value: true, configurable: true });
  const finalX = window.scrollX;
  const finalY = window.scrollY;
  if (next && next.parentNode && next.parentNode instanceof Element) {
    next.parentNode.insertBefore(el, next);
  } else if (prev && prev.parentNode) {
    prev.parentNode.appendChild(el);
  } else {
    (_a2 = getTarget(el)) === null || _a2 === void 0 ? void 0 : _a2.appendChild(el);
  }
  if (!isEnabled(el))
    return cleanUp(el);
  const [top, left, width, height] = deletePosition(el);
  const optionsOrPlugin = getOptions(el);
  const oldCoords = coords.get(el);
  if (finalX !== scrollX || finalY !== scrollY) {
    adjustScroll(el, finalX, finalY, optionsOrPlugin);
  }
  let animation;
  let styleReset = {
    position: "absolute",
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    margin: "0",
    pointerEvents: "none",
    transformOrigin: "center",
    zIndex: "100"
  };
  if (!isPlugin(optionsOrPlugin)) {
    Object.assign(el.style, styleReset);
    animation = el.animate([
      {
        transform: "scale(1)",
        opacity: 1
      },
      {
        transform: "scale(.98)",
        opacity: 0
      }
    ], { duration: optionsOrPlugin.duration, easing: "ease-out" });
  } else {
    const [keyframes, options2] = getPluginTuple(optionsOrPlugin(el, "remove", oldCoords));
    if ((options2 === null || options2 === void 0 ? void 0 : options2.styleReset) !== false) {
      styleReset = (options2 === null || options2 === void 0 ? void 0 : options2.styleReset) || styleReset;
      Object.assign(el.style, styleReset);
    }
    animation = new Animation(keyframes);
    animation.play();
  }
  animations.set(el, animation);
  animation.addEventListener("finish", cleanUp.bind(null, el, styleReset));
}
function adjustScroll(el, finalX, finalY, optionsOrPlugin) {
  const scrollDeltaX = scrollX - finalX;
  const scrollDeltaY = scrollY - finalY;
  const scrollBefore = document.documentElement.style.scrollBehavior;
  const scrollBehavior = getComputedStyle(root).scrollBehavior;
  if (scrollBehavior === "smooth") {
    document.documentElement.style.scrollBehavior = "auto";
  }
  window.scrollTo(window.scrollX + scrollDeltaX, window.scrollY + scrollDeltaY);
  if (!el.parentElement)
    return;
  const parent = el.parentElement;
  let lastHeight = parent.clientHeight;
  let lastWidth = parent.clientWidth;
  const startScroll = performance.now();
  function smoothScroll() {
    requestAnimationFrame(() => {
      if (!isPlugin(optionsOrPlugin)) {
        const deltaY = lastHeight - parent.clientHeight;
        const deltaX = lastWidth - parent.clientWidth;
        if (startScroll + optionsOrPlugin.duration > performance.now()) {
          window.scrollTo({
            left: window.scrollX - deltaX,
            top: window.scrollY - deltaY
          });
          lastHeight = parent.clientHeight;
          lastWidth = parent.clientWidth;
          smoothScroll();
        } else {
          document.documentElement.style.scrollBehavior = scrollBefore;
        }
      }
    });
  }
  smoothScroll();
}
function deletePosition(el) {
  const oldCoords = coords.get(el);
  const [width, , height] = getTransitionSizes(el, oldCoords, getCoords(el));
  let offsetParent = el.parentElement;
  while (offsetParent && (getComputedStyle(offsetParent).position === "static" || offsetParent instanceof HTMLBodyElement)) {
    offsetParent = offsetParent.parentElement;
  }
  if (!offsetParent)
    offsetParent = document.body;
  const parentStyles = getComputedStyle(offsetParent);
  const parentCoords = coords.get(offsetParent) || getCoords(offsetParent);
  const top = Math.round(oldCoords.top - parentCoords.top) - raw(parentStyles.borderTopWidth);
  const left = Math.round(oldCoords.left - parentCoords.left) - raw(parentStyles.borderLeftWidth);
  return [top, left, width, height];
}
function autoAnimate(el, config = {}) {
  if (mutations && resize) {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isDisabledDueToReduceMotion = mediaQuery.matches && !isPlugin(config) && !config.disrespectUserMotionPreference;
    if (!isDisabledDueToReduceMotion) {
      enabled.add(el);
      if (getComputedStyle(el).position === "static") {
        Object.assign(el.style, { position: "relative" });
      }
      forEach(el, updatePos, poll, (element) => resize === null || resize === void 0 ? void 0 : resize.observe(element));
      if (isPlugin(config)) {
        options.set(el, config);
      } else {
        options.set(el, { duration: 250, easing: "ease-in-out", ...config });
      }
      mutations.observe(el, { childList: true });
      parents.add(el);
    }
  }
  return Object.freeze({
    parent: el,
    enable: () => {
      enabled.add(el);
    },
    disable: () => {
      enabled.delete(el);
    },
    isEnabled: () => enabled.has(el)
  });
}
function useAutoAnimate(options2) {
  const [controller, setController] = h();
  const memoizedOptions = T$1(() => options2, []);
  const element = q((node) => {
    if (node instanceof HTMLElement) {
      setController(autoAnimate(node, memoizedOptions));
    } else {
      setController(void 0);
    }
  }, [memoizedOptions]);
  const setEnabled = q((enabled2) => {
    if (controller) {
      enabled2 ? controller.enable() : controller.disable();
    }
  }, [controller]);
  return [element, setEnabled];
}
const getOriginalFileNameFromUrl = (fileURL) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/") ? fileURL.split("/").pop() : new URL(fileURL).pathname.split("/").pop();
    const fileExt = (fileNameFromURL == null ? void 0 : fileNameFromURL.split(".").pop()) ?? "";
    const originalFileName = (fileNameFromURL == null ? void 0 : fileNameFromURL.split("--fid--")[0]) ?? "";
    const fileId = (fileNameFromURL == null ? void 0 : fileNameFromURL.split("--fid--")[1]) ?? "";
    if (!fileId) {
      const fileName2 = originalFileName ? decodeURIComponent(originalFileName || "") : "";
      return fileName2;
    }
    const fileName = originalFileName ? decodeURIComponent(`${originalFileName}.${fileExt}` || "") : "";
    return fileName;
  } catch (error) {
    console.error(`Error parsing file URL: ${error}`);
  }
};
const isFulfilled = (val) => {
  return val.status === "fulfilled";
};
const isRejected = (val) => {
  return val.status === "rejected";
};
const FILE_LIMIT = 25;
const FileInput = ({
  allowedFileExtensions,
  surveyId,
  onFileUpload,
  onUploadCallback,
  fileUrls,
  maxSizeInMB,
  allowMultipleFiles,
  htmlFor = ""
}) => {
  const [selectedFiles, setSelectedFiles] = h([]);
  const [isUploading, setIsUploading] = h(false);
  const [parent] = useAutoAnimate();
  const validateFileSize = async (file) => {
    if (maxSizeInMB) {
      const fileBuffer = await file.arrayBuffer();
      const bufferKB = fileBuffer.byteLength / 1024;
      if (bufferKB > maxSizeInMB * 1024) {
        alert(`File should be less than ${maxSizeInMB} MB`);
        return false;
      }
    }
    return true;
  };
  const handleFileSelection = async (files) => {
    var _a2;
    const fileArray = Array.from(files);
    if (!allowMultipleFiles && fileArray.length > 1) {
      alert("Only one file can be uploaded at a time.");
      return;
    }
    if (allowMultipleFiles && selectedFiles.length + fileArray.length > FILE_LIMIT) {
      alert(`You can only upload a maximum of ${FILE_LIMIT} files.`);
      return;
    }
    const validFiles = Array.from(files).filter((file) => {
      const fileExtension = file.type.substring(file.type.lastIndexOf("/") + 1);
      if (allowedFileExtensions) {
        return allowedFileExtensions == null ? void 0 : allowedFileExtensions.includes(fileExtension);
      } else {
        return true;
      }
    });
    const filteredFiles = [];
    for (const validFile of validFiles) {
      const isAllowed = await validateFileSize(validFile);
      if (isAllowed) {
        filteredFiles.push(validFile);
      }
    }
    try {
      setIsUploading(true);
      const toBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
      });
      const filePromises = filteredFiles.map(async (file) => {
        const base64 = await toBase64(file);
        return { name: file.name, type: file.type, base64 };
      });
      const filesToUpload = await Promise.all(filePromises);
      const uploadPromises = filesToUpload.map((file) => {
        return onFileUpload(file, { allowedFileExtensions, surveyId });
      });
      const uploadedFiles = await Promise.allSettled(uploadPromises);
      const rejectedFiles = uploadedFiles.filter(isRejected);
      const uploadedFilesUrl = uploadedFiles.filter(isFulfilled).map((url) => url.value);
      setSelectedFiles((prevFiles) => [...prevFiles, ...filteredFiles]);
      onUploadCallback(fileUrls ? [...fileUrls, ...uploadedFilesUrl] : uploadedFilesUrl);
      if (rejectedFiles.length > 0) {
        if (((_a2 = rejectedFiles[0].reason) == null ? void 0 : _a2.name) === "FileTooLargeError") {
          alert(rejectedFiles[0].reason.message);
        }
      }
    } catch (err) {
      console.error("error in uploading file: ", err);
      alert("Upload failed! Please try again.");
    } finally {
      setIsUploading(false);
    }
  };
  const handleDragOver = (e2) => {
    e2.preventDefault();
    e2.stopPropagation();
    e2.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e2) => {
    e2.preventDefault();
    e2.stopPropagation();
    handleFileSelection(e2.dataTransfer.files);
  };
  const handleDeleteFile = (index, event) => {
    event.stopPropagation();
    setSelectedFiles((prevFiles) => {
      const newFiles = [...prevFiles];
      newFiles.splice(index, 1);
      return newFiles;
    });
    if (fileUrls) {
      const updatedFileUrls = [...fileUrls];
      updatedFileUrls.splice(index, 1);
      onUploadCallback(updatedFileUrls);
    }
  };
  const showUploader = T$1(() => {
    if (isUploading) return false;
    if (allowMultipleFiles) return true;
    return !(fileUrls && fileUrls.length > 0);
  }, [allowMultipleFiles, fileUrls, isUploading]);
  const uniqueHtmlFor = T$1(() => `selectedFile-${htmlFor}`, [htmlFor]);
  return /* @__PURE__ */ u$1(
    "div",
    {
      className: `fb-items-left fb-bg-input-bg hover:fb-bg-input-bg-selected fb-border-border fb-relative fb-mt-3 fb-flex fb-w-full fb-flex-col fb-justify-center fb-rounded-lg fb-border-2 fb-border-dashed dark:fb-border-slate-600 dark:fb-bg-slate-700 dark:hover:fb-border-slate-500 dark:hover:fb-bg-slate-800`,
      children: [
        /* @__PURE__ */ u$1("div", { ref: parent, children: fileUrls == null ? void 0 : fileUrls.map((fileUrl, index) => {
          const fileName = getOriginalFileNameFromUrl(fileUrl);
          return /* @__PURE__ */ u$1(
            "div",
            {
              className: "fb-bg-input-bg-selected fb-border-border fb-relative fb-m-2 fb-rounded-md fb-border",
              children: [
                /* @__PURE__ */ u$1("div", { className: "fb-absolute fb-right-0 fb-top-0 fb-m-2", children: /* @__PURE__ */ u$1("div", { className: "fb-bg-survey-bg fb-flex fb-h-5 fb-w-5 fb-cursor-pointer fb-items-center fb-justify-center fb-rounded-md", children: /* @__PURE__ */ u$1(
                  "svg",
                  {
                    xmlns: "http://www.w3.org/2000/svg",
                    fill: "none",
                    viewBox: "0 0 26 26",
                    strokeWidth: 1,
                    stroke: "currentColor",
                    className: "fb-text-heading fb-h-5",
                    onClick: (e2) => handleDeleteFile(index, e2),
                    children: /* @__PURE__ */ u$1("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M9 9l10 10m0-10L9 19" })
                  }
                ) }) }),
                /* @__PURE__ */ u$1("div", { className: "fb-flex fb-flex-col fb-items-center fb-justify-center fb-p-2", children: [
                  /* @__PURE__ */ u$1(
                    "svg",
                    {
                      xmlns: "http://www.w3.org/2000/svg",
                      width: "24",
                      height: "24",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "2",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                      className: "fb-text-heading fb-h-6",
                      children: [
                        /* @__PURE__ */ u$1("path", { d: "M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" }),
                        /* @__PURE__ */ u$1("polyline", { points: "14 2 14 8 20 8" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ u$1("p", { className: "fb-text-heading fb-mt-1 fb-w-full fb-overflow-hidden fb-overflow-ellipsis fb-whitespace-nowrap fb-px-2 fb-text-center fb-text-sm", children: fileName })
                ] })
              ]
            },
            index
          );
        }) }),
        /* @__PURE__ */ u$1("div", { children: [
          isUploading && /* @__PURE__ */ u$1("div", { className: "fb-inset-0 fb-flex fb-animate-pulse fb-items-center fb-justify-center fb-rounded-lg fb-py-4", children: /* @__PURE__ */ u$1("label", { htmlFor: uniqueHtmlFor, className: "fb-text-subheading fb-text-sm fb-font-medium", children: "Uploading..." }) }),
          /* @__PURE__ */ u$1("label", { htmlFor: uniqueHtmlFor, onDragOver: handleDragOver, onDrop: handleDrop, children: showUploader && /* @__PURE__ */ u$1(
            "div",
            {
              className: "focus:fb-outline-brand fb-flex fb-flex-col fb-items-center fb-justify-center fb-py-6 hover:fb-cursor-pointer",
              tabIndex: 1,
              onKeyDown: (e2) => {
                var _a2, _b;
                if (e2.key === " ") {
                  e2.preventDefault();
                  (_a2 = document.getElementById(uniqueHtmlFor)) == null ? void 0 : _a2.click();
                  (_b = document.getElementById(uniqueHtmlFor)) == null ? void 0 : _b.focus();
                }
              },
              children: [
                /* @__PURE__ */ u$1(
                  "svg",
                  {
                    xmlns: "http://www.w3.org/2000/svg",
                    fill: "none",
                    viewBox: "0 0 24 24",
                    strokeWidth: 1.5,
                    stroke: "currentColor",
                    className: "fb-text-placeholder fb-h-6",
                    children: /* @__PURE__ */ u$1(
                      "path",
                      {
                        strokeLinecap: "round",
                        strokeLinejoin: "round",
                        d: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      }
                    )
                  }
                ),
                /* @__PURE__ */ u$1("p", { className: "fb-text-placeholder fb-mt-2 fb-text-sm dark:fb-text-slate-400", children: /* @__PURE__ */ u$1("span", { className: "fb-font-medium", children: "Click or drag to upload files." }) }),
                /* @__PURE__ */ u$1(
                  "input",
                  {
                    type: "file",
                    id: uniqueHtmlFor,
                    name: uniqueHtmlFor,
                    accept: allowedFileExtensions == null ? void 0 : allowedFileExtensions.map((ext) => `.${ext}`).join(","),
                    className: "fb-hidden",
                    onChange: async (e2) => {
                      const inputElement = e2.target;
                      if (inputElement.files) {
                        handleFileSelection(inputElement.files);
                      }
                    },
                    multiple: allowMultipleFiles
                  }
                )
              ]
            }
          ) })
        ] })
      ]
    }
  );
};
const FileUploadQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  surveyId,
  onFileUpload,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        if (question.required) {
          if (value && value.length > 0) {
            onSubmit({ [question.id]: value }, updatedTtcObj);
          } else {
            alert("Please upload a file");
          }
        } else {
          if (value) {
            onSubmit({ [question.id]: value }, updatedTtcObj);
          } else {
            onSubmit({ [question.id]: "skipped" }, updatedTtcObj);
          }
        }
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1(
            FileInput,
            {
              htmlFor: question.id,
              surveyId,
              onFileUpload,
              onUploadCallback: (urls) => {
                if (urls) {
                  onChange({ [question.id]: urls });
                } else {
                  onChange({ [question.id]: "skipped" });
                }
              },
              fileUrls: value,
              allowMultipleFiles: question.allowMultipleFiles,
              ...!!question.allowedFileExtensions ? { allowedFileExtensions: question.allowedFileExtensions } : {},
              ...!!question.maxSizeInMB ? { maxSizeInMB: question.maxSizeInMB } : {}
            }
          )
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const MatrixQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const rowShuffleIdx = T$1(() => {
    if (question.shuffleOption) {
      return getShuffledRowIndices(question.rows.length, question.shuffleOption);
    } else {
      return question.rows.map((_2, id) => id);
    }
  }, [question.shuffleOption, question.rows.length]);
  const questionRows = T$1(() => {
    if (!question.rows) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === void 0) {
      return question.rows;
    }
    return rowShuffleIdx.map((shuffledIdx) => {
      return question.rows[shuffledIdx];
    });
  }, [question.shuffleOption, question.rows, rowShuffleIdx]);
  const handleSelect = q(
    (column, row) => {
      let responseValue = Object.entries(value).length !== 0 ? { ...value } : question.rows.reduce((obj, key) => {
        obj[getLocalizedValue(key, languageCode)] = "";
        return obj;
      }, {});
      responseValue[row] = responseValue[row] === column ? "" : column;
      if (Object.values(responseValue).every((val) => val === "")) {
        responseValue = {};
      }
      onChange({ [question.id]: responseValue });
    },
    [value, question.rows, question.id, onChange, languageCode]
  );
  const handleSubmit = q(
    (e2) => {
      e2.preventDefault();
      const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
      setTtc(updatedTtc);
      onSubmit({ [question.id]: value }, updatedTtc);
    },
    [ttc, question.id, startTime, value, onSubmit, setTtc]
  );
  const handleBackButtonClick = q(() => {
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    onBack();
  }, [ttc, question.id, startTime, onBack, setTtc]);
  const columnsHeaders = T$1(
    () => question.columns.map((column, index) => /* @__PURE__ */ u$1(
      "th",
      {
        className: "fb-text-heading fb-max-w-40 fb-break-words fb-px-4 fb-py-2 fb-font-normal",
        dir: "auto",
        children: getLocalizedValue(column, languageCode)
      },
      index
    )),
    [question.columns, languageCode]
  );
  return /* @__PURE__ */ u$1("form", { onSubmit: handleSubmit, className: "fb-w-full", children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: getLocalizedValue(question.headline, languageCode),
          questionId: question.id,
          required: question.required
        }
      ),
      /* @__PURE__ */ u$1(
        Subheader,
        {
          subheader: getLocalizedValue(question.subheader, languageCode),
          questionId: question.id
        }
      ),
      /* @__PURE__ */ u$1("div", { className: "fb-overflow-x-auto fb-py-4", children: /* @__PURE__ */ u$1("table", { className: "fb-no-scrollbar fb-min-w-full fb-table-auto fb-border-collapse fb-text-sm", children: [
        /* @__PURE__ */ u$1("thead", { children: /* @__PURE__ */ u$1("tr", { children: [
          /* @__PURE__ */ u$1("th", { className: "fb-px-4 fb-py-2" }),
          columnsHeaders
        ] }) }),
        /* @__PURE__ */ u$1("tbody", { children: questionRows.map((row, rowIndex) => (
          // Table rows
          /* @__PURE__ */ u$1("tr", { className: `${rowIndex % 2 === 0 ? "bg-input-bg" : ""}`, children: [
            /* @__PURE__ */ u$1(
              "td",
              {
                className: "fb-text-heading fb-rounded-l-custom fb-max-w-40 fb-break-words fb-pr-4 fb-pl-2 fb-py-2",
                dir: "auto",
                children: getLocalizedValue(row, languageCode)
              }
            ),
            question.columns.map((column, columnIndex) => /* @__PURE__ */ u$1(
              "td",
              {
                tabIndex: 0,
                className: `fb-outline-brand fb-px-4 fb-py-2 fb-text-gray-800 ${columnIndex === question.columns.length - 1 ? "fb-rounded-r-custom" : ""}`,
                onClick: () => handleSelect(
                  getLocalizedValue(column, languageCode),
                  getLocalizedValue(row, languageCode)
                ),
                onKeyDown: (e2) => {
                  if (e2.key === " ") {
                    e2.preventDefault();
                    handleSelect(
                      getLocalizedValue(column, languageCode),
                      getLocalizedValue(row, languageCode)
                    );
                  }
                },
                dir: "auto",
                children: /* @__PURE__ */ u$1("div", { className: "fb-flex fb-items-center fb-justify-center fb-p-2", children: /* @__PURE__ */ u$1(
                  "input",
                  {
                    dir: "auto",
                    type: "radio",
                    tabIndex: -1,
                    required: question.required,
                    id: `${row}-${column}`,
                    name: getLocalizedValue(row, languageCode),
                    value: getLocalizedValue(column, languageCode),
                    checked: typeof value === "object" && !Array.isArray(value) ? value[getLocalizedValue(row, languageCode)] === getLocalizedValue(column, languageCode) : false,
                    className: "fb-border-brand fb-text-brand fb-h-5 fb-w-5 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
                  }
                ) })
              },
              columnIndex
            ))
          ] })
        )) })
      ] }) })
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
      !isFirstQuestion && /* @__PURE__ */ u$1(
        BackButton,
        {
          backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
          onClick: handleBackButtonClick,
          tabIndex: 0
        }
      ),
      /* @__PURE__ */ u$1("div", {}),
      /* @__PURE__ */ u$1(
        SubmitButton,
        {
          buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
          isLastQuestion,
          onClick: () => {
          },
          tabIndex: 0
        }
      )
    ] })
  ] }, question.id);
};
const MultipleChoiceMultiQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const shuffledChoicesIds = T$1(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    } else return question.choices.map((choice) => choice.id);
  }, [question.shuffleOption, question.choices.length, question.choices[question.choices.length - 1].id]);
  const getChoicesWithoutOtherLabels = q(
    () => question.choices.filter((choice) => choice.id !== "other").map((item) => getLocalizedValue(item.label, languageCode)),
    [question, languageCode]
  );
  const [otherSelected, setOtherSelected] = h(false);
  const [otherValue, setOtherValue] = h("");
  y(() => {
    setOtherSelected(
      !!value && (Array.isArray(value) ? value : [value]).some((item) => {
        return getChoicesWithoutOtherLabels().includes(item) === false;
      })
    );
    setOtherValue(
      Array.isArray(value) && value.filter((v2) => !question.choices.find((c2) => c2.label[languageCode] === v2))[0] || ""
    );
  }, [question.id, getChoicesWithoutOtherLabels, question.choices, value, languageCode]);
  const questionChoices = T$1(() => {
    if (!question.choices) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === void 0) return question.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = question.choices.find((choice2) => {
        return choice2.id === choiceId;
      });
      return choice;
    });
  }, [question.choices, question.shuffleOption, shuffledChoicesIds]);
  const questionChoiceLabels = questionChoices.map((questionChoice) => {
    return questionChoice == null ? void 0 : questionChoice.label[languageCode];
  });
  const otherOption = T$1(
    () => question.choices.find((choice) => choice.id === "other"),
    [question.choices]
  );
  const otherSpecify = A$1(null);
  const choicesContainerRef = A$1(null);
  y(() => {
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);
  const addItem = (item) => {
    const isOtherValue = !questionChoiceLabels.includes(item);
    if (Array.isArray(value)) {
      if (isOtherValue) {
        const newValue = value.filter((v2) => {
          return questionChoiceLabels.includes(v2);
        });
        return onChange({ [question.id]: [...newValue, item] });
      } else {
        return onChange({ [question.id]: [...value, item] });
      }
    }
    return onChange({ [question.id]: [item] });
  };
  const removeItem = (item) => {
    if (Array.isArray(value)) {
      return onChange({ [question.id]: value.filter((i2) => i2 !== item) });
    }
    return onChange({ [question.id]: [] });
  };
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const newValue = value == null ? void 0 : value.filter((item) => {
          return getChoicesWithoutOtherLabels().includes(item) || item === otherValue;
        });
        onChange({ [question.id]: newValue });
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mt-4", children: /* @__PURE__ */ u$1("fieldset", { children: [
            /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Options" }),
            /* @__PURE__ */ u$1("div", { className: "fb-bg-survey-bg fb-relative fb-space-y-2", ref: choicesContainerRef, children: [
              questionChoices.map((choice, idx) => {
                if (!choice || choice.id === "other") return;
                return /* @__PURE__ */ u$1(
                  "label",
                  {
                    tabIndex: idx + 1,
                    className: cn(
                      value.includes(getLocalizedValue(choice.label, languageCode)) ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border fb-bg-input-bg",
                      "fb-text-heading focus-within:fb-border-brand hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                    ),
                    onKeyDown: (e2) => {
                      var _a2, _b;
                      if (e2.key === " ") {
                        e2.preventDefault();
                        (_a2 = document.getElementById(choice.id)) == null ? void 0 : _a2.click();
                        (_b = document.getElementById(choice.id)) == null ? void 0 : _b.focus();
                      }
                    },
                    autoFocus: idx === 0 && autoFocusEnabled,
                    children: /* @__PURE__ */ u$1("span", { className: "fb-flex fb-items-center fb-text-sm", dir: "auto", children: [
                      /* @__PURE__ */ u$1(
                        "input",
                        {
                          type: "checkbox",
                          id: choice.id,
                          name: question.id,
                          tabIndex: -1,
                          value: getLocalizedValue(choice.label, languageCode),
                          className: "fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0",
                          "aria-labelledby": `${choice.id}-label`,
                          onChange: (e2) => {
                            var _a2;
                            if ((_a2 = e2.target) == null ? void 0 : _a2.checked) {
                              addItem(getLocalizedValue(choice.label, languageCode));
                            } else {
                              removeItem(getLocalizedValue(choice.label, languageCode));
                            }
                          },
                          checked: Array.isArray(value) && value.includes(getLocalizedValue(choice.label, languageCode)),
                          required: question.required && Array.isArray(value) && value.length ? false : question.required
                        }
                      ),
                      /* @__PURE__ */ u$1("span", { id: `${choice.id}-label`, className: "fb-ml-3 fb-mr-3 fb-grow fb-font-medium", children: getLocalizedValue(choice.label, languageCode) })
                    ] })
                  },
                  choice.id
                );
              }),
              otherOption && /* @__PURE__ */ u$1(
                "label",
                {
                  tabIndex: questionChoices.length + 1,
                  className: cn(
                    value.includes(getLocalizedValue(otherOption.label, languageCode)) ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
                    "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                  ),
                  onKeyDown: (e2) => {
                    var _a2, _b;
                    if (e2.key === " ") {
                      if (otherSelected) return;
                      (_a2 = document.getElementById(otherOption.id)) == null ? void 0 : _a2.click();
                      (_b = document.getElementById(otherOption.id)) == null ? void 0 : _b.focus();
                    }
                  },
                  children: [
                    /* @__PURE__ */ u$1("span", { className: "fb-flex fb-items-center fb-text-sm", dir: "auto", children: [
                      /* @__PURE__ */ u$1(
                        "input",
                        {
                          type: "checkbox",
                          tabIndex: -1,
                          id: otherOption.id,
                          name: question.id,
                          value: getLocalizedValue(otherOption.label, languageCode),
                          className: "fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0",
                          "aria-labelledby": `${otherOption.id}-label`,
                          onChange: () => {
                            setOtherSelected(!otherSelected);
                            if (!value.includes(otherValue)) {
                              addItem(otherValue);
                            } else {
                              removeItem(otherValue);
                            }
                          },
                          checked: otherSelected
                        }
                      ),
                      /* @__PURE__ */ u$1("span", { id: `${otherOption.id}-label`, className: "fb-ml-3 fb-mr-3 fb-grow fb-font-medium", children: getLocalizedValue(otherOption.label, languageCode) })
                    ] }),
                    otherSelected && /* @__PURE__ */ u$1(
                      "input",
                      {
                        ref: otherSpecify,
                        dir: "auto",
                        id: `${otherOption.id}-label`,
                        name: question.id,
                        tabIndex: questionChoices.length + 1,
                        value: otherValue,
                        onChange: (e2) => {
                          setOtherValue(e2.currentTarget.value);
                          addItem(e2.currentTarget.value);
                        },
                        className: "placeholder:fb-text-placeholder fb-border-border fb-bg-survey-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-mt-3 fb-flex fb-h-10 fb-w-full fb-border fb-px-3 fb-py-2 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50",
                        placeholder: getLocalizedValue(question.otherOptionPlaceholder, languageCode) ?? "Please specify",
                        required: question.required,
                        "aria-labelledby": `${otherOption.id}-label`
                      }
                    )
                  ]
                }
              )
            ] })
          ] }) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              tabIndex: questionChoices.length + 3,
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: questionChoices.length + 2,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const MultipleChoiceSingleQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const [otherSelected, setOtherSelected] = h(false);
  const otherSpecify = A$1(null);
  const choicesContainerRef = A$1(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const shuffledChoicesIds = T$1(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    } else return question.choices.map((choice) => choice.id);
  }, [question.shuffleOption, question.choices.length, question.choices[question.choices.length - 1].id]);
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const questionChoices = T$1(() => {
    if (!question.choices) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === void 0) return question.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = question.choices.find((choice2) => {
        return choice2.id === choiceId;
      });
      return choice;
    });
  }, [question.choices, question.shuffleOption, shuffledChoicesIds]);
  const otherOption = T$1(
    () => question.choices.find((choice) => choice.id === "other"),
    [question.choices]
  );
  y(() => {
    if (isFirstQuestion && !value) {
      const prefillAnswer = new URLSearchParams(window.location.search).get(question.id);
      if (prefillAnswer) {
        if (otherOption && prefillAnswer === getLocalizedValue(otherOption.label, languageCode)) {
          setOtherSelected(true);
          return;
        }
      }
    }
    const isOtherSelected = value !== void 0 && !questionChoices.some((choice) => (choice == null ? void 0 : choice.label[languageCode]) === value);
    setOtherSelected(isOtherSelected);
  }, [isFirstQuestion, languageCode, otherOption, question.id, questionChoices, value]);
  y(() => {
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mt-4", children: /* @__PURE__ */ u$1("fieldset", { children: [
            /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Options" }),
            /* @__PURE__ */ u$1(
              "div",
              {
                className: "fb-bg-survey-bg fb-relative fb-space-y-2",
                role: "radiogroup",
                ref: choicesContainerRef,
                children: [
                  questionChoices.map((choice, idx) => {
                    if (!choice || choice.id === "other") return;
                    return /* @__PURE__ */ u$1(
                      "label",
                      {
                        dir: "auto",
                        tabIndex: idx + 1,
                        className: cn(
                          value === getLocalizedValue(choice.label, languageCode) ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
                          "fb-text-heading fb-bg-input-bg focus-within:fb-border-brand focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                        ),
                        onKeyDown: (e2) => {
                          var _a2, _b;
                          if (e2.key === " ") {
                            e2.preventDefault();
                            (_a2 = document.getElementById(choice.id)) == null ? void 0 : _a2.click();
                            (_b = document.getElementById(choice.id)) == null ? void 0 : _b.focus();
                          }
                        },
                        autoFocus: idx === 0 && autoFocusEnabled,
                        children: /* @__PURE__ */ u$1("span", { className: "fb-flex fb-items-center fb-text-sm", children: [
                          /* @__PURE__ */ u$1(
                            "input",
                            {
                              tabIndex: -1,
                              type: "radio",
                              id: choice.id,
                              name: question.id,
                              value: getLocalizedValue(choice.label, languageCode),
                              dir: "auto",
                              className: "fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0",
                              "aria-labelledby": `${choice.id}-label`,
                              onChange: () => {
                                setOtherSelected(false);
                                onChange({ [question.id]: getLocalizedValue(choice.label, languageCode) });
                              },
                              checked: value === getLocalizedValue(choice.label, languageCode),
                              required: question.required && idx === 0
                            }
                          ),
                          /* @__PURE__ */ u$1("span", { id: `${choice.id}-label`, className: "fb-ml-3 fb-mr-3 fb-grow fb-font-medium", children: getLocalizedValue(choice.label, languageCode) })
                        ] })
                      },
                      choice.id
                    );
                  }),
                  otherOption && /* @__PURE__ */ u$1(
                    "label",
                    {
                      dir: "auto",
                      tabIndex: questionChoices.length + 1,
                      className: cn(
                        value === getLocalizedValue(otherOption.label, languageCode) ? "fb-border-brand fb-bg-input-bg-selected fb-z-10" : "fb-border-border",
                        "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                      ),
                      onKeyDown: (e2) => {
                        var _a2, _b;
                        if (e2.key === " ") {
                          if (otherSelected) return;
                          (_a2 = document.getElementById(otherOption.id)) == null ? void 0 : _a2.click();
                          (_b = document.getElementById(otherOption.id)) == null ? void 0 : _b.focus();
                        }
                      },
                      children: [
                        /* @__PURE__ */ u$1("span", { className: "fb-flex fb-items-center fb-text-sm", children: [
                          /* @__PURE__ */ u$1(
                            "input",
                            {
                              dir: "auto",
                              type: "radio",
                              id: otherOption.id,
                              tabIndex: -1,
                              name: question.id,
                              value: getLocalizedValue(otherOption.label, languageCode),
                              className: "fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0",
                              "aria-labelledby": `${otherOption.id}-label`,
                              onChange: () => {
                                setOtherSelected(!otherSelected);
                                onChange({ [question.id]: "" });
                              },
                              checked: otherSelected
                            }
                          ),
                          /* @__PURE__ */ u$1(
                            "span",
                            {
                              id: `${otherOption.id}-label`,
                              className: "fb-ml-3 fb-mr-3 fb-grow fb-font-medium",
                              dir: "auto",
                              children: getLocalizedValue(otherOption.label, languageCode)
                            }
                          )
                        ] }),
                        otherSelected && /* @__PURE__ */ u$1(
                          "input",
                          {
                            ref: otherSpecify,
                            tabIndex: questionChoices.length + 1,
                            id: `${otherOption.id}-label`,
                            dir: "auto",
                            name: question.id,
                            value,
                            onChange: (e2) => {
                              onChange({ [question.id]: e2.currentTarget.value });
                            },
                            className: "placeholder:fb-text-placeholder fb-border-border fb-bg-survey-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-mt-3 fb-flex fb-h-10 fb-w-full fb-border fb-px-3 fb-py-2 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50",
                            placeholder: getLocalizedValue(question.otherOptionPlaceholder, languageCode) ?? "Please specify",
                            required: question.required,
                            "aria-labelledby": `${otherOption.id}-label`
                          }
                        )
                      ]
                    }
                  )
                ]
              }
            )
          ] }) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              tabIndex: questionChoices.length + 3,
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: questionChoices.length + 2,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const NPSQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const [hoveredNumber, setHoveredNumber] = h(-1);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const handleClick = (number2) => {
    onChange({ [question.id]: number2 });
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    setTimeout(() => {
      onSubmit(
        {
          [question.id]: number2
        },
        updatedTtcObj
      );
    }, 250);
  };
  const getNPSOptionColor = (idx) => {
    return idx > 8 ? "fb-bg-emerald-100" : idx > 6 ? "fb-bg-orange-100" : "fb-bg-rose-100";
  };
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      },
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-my-4", children: /* @__PURE__ */ u$1("fieldset", { children: [
            /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Options" }),
            /* @__PURE__ */ u$1("div", { className: "fb-flex", children: Array.from({ length: 11 }, (_2, i2) => i2).map((number2, idx) => {
              return /* @__PURE__ */ u$1(
                "label",
                {
                  tabIndex: idx + 1,
                  onMouseOver: () => setHoveredNumber(number2),
                  onMouseLeave: () => setHoveredNumber(-1),
                  onKeyDown: (e2) => {
                    var _a2, _b;
                    if (e2.key === " ") {
                      e2.preventDefault();
                      (_a2 = document.getElementById(number2.toString())) == null ? void 0 : _a2.click();
                      (_b = document.getElementById(number2.toString())) == null ? void 0 : _b.focus();
                    }
                  },
                  className: cn(
                    value === number2 ? "fb-border-border-highlight fb-bg-accent-selected-bg fb-z-10 fb-border" : "fb-border-border",
                    "fb-text-heading first:fb-rounded-l-custom last:fb-rounded-r-custom focus:fb-border-brand fb-relative fb-h-10 fb-flex-1 fb-cursor-pointer fb-overflow-hidden fb-border-b fb-border-l fb-border-t fb-text-center fb-text-sm last:fb-border-r focus:fb-border-2 focus:fb-outline-none",
                    question.isColorCodingEnabled ? "fb-h-[46px] fb-leading-[3.5em]" : "fb-h fb-leading-10",
                    hoveredNumber === number2 ? "fb-bg-accent-bg" : ""
                  ),
                  children: [
                    question.isColorCodingEnabled && /* @__PURE__ */ u$1(
                      "div",
                      {
                        className: `fb-absolute fb-left-0 fb-top-0 fb-h-[6px] fb-w-full ${getNPSOptionColor(idx)}`
                      }
                    ),
                    /* @__PURE__ */ u$1(
                      "input",
                      {
                        type: "radio",
                        id: number2.toString(),
                        name: "nps",
                        value: number2,
                        checked: value === number2,
                        className: "fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0",
                        onClick: () => handleClick(number2),
                        required: question.required
                      }
                    ),
                    number2
                  ]
                },
                number2
              );
            }) }),
            /* @__PURE__ */ u$1("div", { className: "fb-text-subheading fb-mt-2 fb-flex fb-justify-between fb-px-1.5 fb-text-xs fb-leading-6", children: [
              /* @__PURE__ */ u$1("p", { dir: "auto", children: getLocalizedValue(question.lowerLabel, languageCode) }),
              /* @__PURE__ */ u$1("p", { dir: "auto", children: getLocalizedValue(question.upperLabel, languageCode) })
            ] })
          ] }) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              tabIndex: isLastQuestion ? 12 : 13,
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          !question.required && /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: 12,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const OpenTextQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const handleInputChange = (inputValue) => {
    onChange({ [question.id]: inputValue });
  };
  const handleInputResize = (event) => {
    let maxHeight = 160;
    const textarea = event.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflow = newHeight >= maxHeight ? "auto" : "hidden";
  };
  const openTextRef = q(
    (currentElement) => {
      if (question.id && currentElement && autoFocusEnabled && question.id === currentQuestionId) {
        currentElement.focus();
      }
    },
    [question.id, autoFocusEnabled, currentQuestionId]
  );
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value }, updatedttc);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mt-4", children: question.longAnswer === false ? /* @__PURE__ */ u$1(
            "input",
            {
              ref: openTextRef,
              tabIndex: 1,
              name: question.id,
              id: question.id,
              placeholder: getLocalizedValue(question.placeholder, languageCode),
              dir: "auto",
              step: "any",
              required: question.required,
              value: value ? value : "",
              type: question.inputType,
              onInput: (e2) => handleInputChange(e2.currentTarget.value),
              autoFocus: autoFocusEnabled,
              className: "fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm",
              pattern: question.inputType === "phone" ? "[0-9+ ]+" : ".*",
              title: question.inputType === "phone" ? "Enter a valid phone number" : void 0
            }
          ) : /* @__PURE__ */ u$1(
            "textarea",
            {
              ref: openTextRef,
              rows: 3,
              name: question.id,
              tabIndex: 1,
              "aria-label": "textarea",
              id: question.id,
              placeholder: getLocalizedValue(question.placeholder, languageCode),
              dir: "auto",
              required: question.required,
              value,
              type: question.inputType,
              onInput: (e2) => {
                handleInputChange(e2.currentTarget.value);
                handleInputResize(e2);
              },
              autoFocus: autoFocusEnabled,
              className: "fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm",
              pattern: question.inputType === "phone" ? "[+][0-9 ]+" : ".*",
              title: question.inputType === "phone" ? "Please enter a valid phone number" : void 0
            }
          ) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedttc);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion,
              onClick: () => {
              }
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const PictureSelectionQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const addItem = (item) => {
    let values = [];
    if (question.allowMulti) {
      values = [...value, item];
    } else {
      values = [item];
    }
    return onChange({ [question.id]: values });
  };
  const removeItem = (item) => {
    let values = [];
    if (question.allowMulti) {
      values = value.filter((i2) => i2 !== item);
    } else {
      values = [];
    }
    return onChange({ [question.id]: values });
  };
  const handleChange = (id) => {
    if (value.includes(id)) {
      removeItem(id);
    } else {
      addItem(id);
    }
  };
  y(() => {
    if (!question.allowMulti && value.length > 1) {
      onChange({ [question.id]: [] });
    }
  }, [question.allowMulti]);
  const questionChoices = question.choices;
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mt-4", children: /* @__PURE__ */ u$1("fieldset", { children: [
            /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Options" }),
            /* @__PURE__ */ u$1("div", { className: "fb-bg-survey-bg fb-relative fb-grid fb-grid-cols-2 fb-gap-4", children: questionChoices.map((choice, idx) => /* @__PURE__ */ u$1(
              "label",
              {
                tabIndex: idx + 1,
                htmlFor: choice.id,
                onKeyDown: (e2) => {
                  var _a2, _b;
                  if (e2.key === " ") {
                    e2.preventDefault();
                    (_a2 = document.getElementById(choice.id)) == null ? void 0 : _a2.click();
                    (_b = document.getElementById(choice.id)) == null ? void 0 : _b.focus();
                  }
                },
                onClick: () => handleChange(choice.id),
                className: cn(
                  "fb-relative fb-w-full fb-cursor-pointer fb-overflow-hidden fb-border fb-rounded-custom focus:fb-outline-none fb-aspect-[4/3] fb-min-h-[7rem] fb-max-h-[50vh] focus:fb-border-brand focus:fb-border-4 group/image",
                  Array.isArray(value) && value.includes(choice.id) ? "fb-border-brand fb-text-brand fb-z-10 fb-border-4 fb-shadow-sm" : ""
                ),
                children: [
                  /* @__PURE__ */ u$1(
                    "img",
                    {
                      src: choice.imageUrl,
                      id: choice.id,
                      alt: choice.imageUrl.split("/").pop(),
                      className: "fb-h-full fb-w-full fb-object-cover"
                    }
                  ),
                  /* @__PURE__ */ u$1(
                    "a",
                    {
                      tabIndex: -1,
                      href: choice.imageUrl,
                      target: "_blank",
                      title: "Open in new tab",
                      rel: "noreferrer",
                      onClick: (e2) => e2.stopPropagation(),
                      className: "fb-absolute fb-bottom-2 fb-right-2 fb-flex fb-items-center fb-gap-2 fb-whitespace-nowrap fb-rounded-md fb-bg-gray-800 fb-bg-opacity-40 fb-p-1.5 fb-text-white fb-opacity-0 fb-backdrop-blur-lg fb-transition fb-duration-300 fb-ease-in-out hover:fb-bg-opacity-65 group-hover/image:fb-opacity-100",
                      children: /* @__PURE__ */ u$1(
                        "svg",
                        {
                          xmlns: "http://www.w3.org/2000/svg",
                          width: "16",
                          height: "16",
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: "1",
                          "stroke-linecap": "round",
                          "stroke-linejoin": "round",
                          class: "lucide lucide-expand",
                          children: [
                            /* @__PURE__ */ u$1("path", { d: "m21 21-6-6m6 6v-4.8m0 4.8h-4.8" }),
                            /* @__PURE__ */ u$1("path", { d: "M3 16.2V21m0 0h4.8M3 21l6-6" }),
                            /* @__PURE__ */ u$1("path", { d: "M21 7.8V3m0 0h-4.8M21 3l-6 6" }),
                            /* @__PURE__ */ u$1("path", { d: "M3 7.8V3m0 0h4.8M3 3l6 6" })
                          ]
                        }
                      )
                    }
                  ),
                  question.allowMulti ? /* @__PURE__ */ u$1(
                    "input",
                    {
                      id: `${choice.id}-checked`,
                      name: `${choice.id}-checkbox`,
                      type: "checkbox",
                      tabIndex: -1,
                      checked: value.includes(choice.id),
                      className: cn(
                        "fb-border-border fb-rounded-custom fb-pointer-events-none fb-absolute fb-right-2 fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-border",
                        value.includes(choice.id) ? "fb-border-brand fb-text-brand" : ""
                      ),
                      required: question.required && value.length ? false : question.required
                    }
                  ) : /* @__PURE__ */ u$1(
                    "input",
                    {
                      id: `${choice.id}-radio`,
                      name: `${choice.id}-radio`,
                      type: "radio",
                      tabIndex: -1,
                      checked: value.includes(choice.id),
                      className: cn(
                        "fb-border-border fb-pointer-events-none fb-absolute fb-right-2 fb-top-2 fb-z-20 fb-h-5 fb-w-5 fb-rounded-full fb-border",
                        value.includes(choice.id) ? "fb-border-brand fb-text-brand" : ""
                      ),
                      required: question.required && value.length ? false : question.required
                    }
                  )
                ]
              },
              choice.id
            )) })
          ] }) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              tabIndex: questionChoices.length + 3,
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: questionChoices.length + 2,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const RankingQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const [startTime, setStartTime] = h(performance.now());
  const shuffledChoicesIds = T$1(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    } else return question.choices.map((choice) => choice.id);
  }, [question.shuffleOption, question.choices.length]);
  const [parent] = useAutoAnimate();
  const [error, setError] = h(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const sortedItems = T$1(() => {
    return value.map((id) => question.choices.find((c2) => c2.id === id)).filter((item) => item !== void 0);
  }, [value, question.choices]);
  const unsortedItems = T$1(() => {
    if (question.shuffleOption === "all" && sortedItems.length === 0) {
      return shuffledChoicesIds.map((id) => question.choices.find((c2) => c2.id === id));
    } else {
      return question.choices.filter((c2) => !value.includes(c2.id));
    }
  }, [question.choices, value, question.shuffleOption]);
  const handleItemClick = q(
    (item) => {
      const isAlreadySorted = sortedItems.some((sortedItem) => sortedItem.id === item.id);
      const newSortedItems = isAlreadySorted ? sortedItems.filter((sortedItem) => sortedItem.id !== item.id) : [...sortedItems, item];
      onChange({ [question.id]: newSortedItems.map((item2) => getLocalizedValue(item2.label, languageCode)) });
      setError(null);
    },
    [onChange, question.id, sortedItems]
  );
  const handleMove = q(
    (itemId, direction) => {
      const index = sortedItems.findIndex((item) => item.id === itemId);
      if (index === -1) return;
      const newSortedItems = [...sortedItems];
      const [movedItem] = newSortedItems.splice(index, 1);
      const newIndex = direction === "up" ? Math.max(0, index - 1) : Math.min(newSortedItems.length, index + 1);
      newSortedItems.splice(newIndex, 0, movedItem);
      onChange({ [question.id]: newSortedItems.map((item) => getLocalizedValue(item.label, languageCode)) });
      setError(null);
    },
    [sortedItems, onChange, question.id]
  );
  const handleSubmit = (e2) => {
    e2.preventDefault();
    const hasIncompleteRanking = question.required && sortedItems.length !== question.choices.length || !question.required && sortedItems.length > 0 && sortedItems.length < question.choices.length;
    if (hasIncompleteRanking) {
      setError("Please rank all items before submitting.");
      return;
    }
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    onSubmit(
      { [question.id]: sortedItems.map((item) => getLocalizedValue(item.label, languageCode)) },
      updatedTtcObj
    );
  };
  return /* @__PURE__ */ u$1("form", { onSubmit: handleSubmit, className: "fb-w-full", children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: getLocalizedValue(question.headline, languageCode),
          questionId: question.id,
          required: question.required
        }
      ),
      /* @__PURE__ */ u$1(
        Subheader,
        {
          subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
          questionId: question.id
        }
      ),
      /* @__PURE__ */ u$1("div", { className: "fb-mt-4", children: /* @__PURE__ */ u$1("fieldset", { children: [
        /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Ranking Items" }),
        /* @__PURE__ */ u$1("div", { className: "fb-relative", ref: parent, children: [...sortedItems, ...unsortedItems].map((item, idx) => {
          if (!item) return;
          const isSorted = sortedItems.includes(item);
          const isFirst = isSorted && idx === 0;
          const isLast = isSorted && idx === sortedItems.length - 1;
          return /* @__PURE__ */ u$1(
            "div",
            {
              tabIndex: idx + 1,
              className: cn(
                "fb-flex fb-h-12 fb-items-center fb-mb-2 fb-border fb-border-border fb-transition-all fb-text-heading focus-within:fb-border-brand hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-cursor-pointer focus:fb-outline-none fb-transform fb-duration-500 fb-ease-in-out",
                isSorted ? "fb-bg-input-bg-selected" : "fb-bg-input-bg"
              ),
              autoFocus: idx === 0 && autoFocusEnabled,
              children: [
                /* @__PURE__ */ u$1(
                  "div",
                  {
                    className: "fb-flex fb-gap-x-4 fb-px-4 fb-items-center fb-grow fb-h-full group",
                    onClick: () => handleItemClick(item),
                    children: [
                      /* @__PURE__ */ u$1(
                        "span",
                        {
                          className: cn(
                            "fb-w-6 fb-grow-0 fb-h-6 fb-flex fb-items-center fb-justify-center fb-rounded-full fb-text-xs fb-font-semibold fb-border-brand fb-border",
                            isSorted ? "fb-bg-brand fb-text-white fb-border" : "fb-border-dashed group-hover:fb-bg-white fb-text-transparent group-hover:fb-text-heading"
                          ),
                          children: (idx + 1).toString()
                        }
                      ),
                      /* @__PURE__ */ u$1("div", { className: "fb-grow fb-shrink fb-font-medium fb-text-sm", children: getLocalizedValue(item.label, languageCode) })
                    ]
                  }
                ),
                isSorted && /* @__PURE__ */ u$1("div", { className: "fb-flex fb-flex-col fb-h-full fb-grow-0 fb-border-l fb-border-border", children: [
                  /* @__PURE__ */ u$1(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleMove(item.id, "up"),
                      className: cn(
                        "fb-px-2 fb-flex fb-flex-1 fb-items-center fb-justify-center",
                        isFirst ? "fb-opacity-30 fb-cursor-not-allowed" : "hover:fb-bg-black/5 fb-rounded-tr-custom fb-transition-colors"
                      ),
                      disabled: isFirst,
                      children: /* @__PURE__ */ u$1(
                        "svg",
                        {
                          xmlns: "http://www.w3.org/2000/svg",
                          width: "20",
                          height: "20",
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: "2",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          className: "lucide lucide-chevron-up",
                          children: /* @__PURE__ */ u$1("path", { d: "m18 15-6-6-6 6" })
                        }
                      )
                    }
                  ),
                  /* @__PURE__ */ u$1(
                    "button",
                    {
                      type: "button",
                      onClick: () => handleMove(item.id, "down"),
                      className: cn(
                        "fb-px-2 fb-flex-1 fb-border-t fb-border-border fb-flex fb-items-center fb-justify-center",
                        isLast ? "fb-opacity-30 fb-cursor-not-allowed" : "hover:fb-bg-black/5 fb-rounded-br-custom fb-transition-colors"
                      ),
                      disabled: isLast,
                      children: /* @__PURE__ */ u$1(
                        "svg",
                        {
                          xmlns: "http://www.w3.org/2000/svg",
                          width: "20",
                          height: "20",
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          strokeWidth: "2",
                          strokeLinecap: "round",
                          strokeLinejoin: "round",
                          className: "lucide lucide-chevron-down",
                          children: /* @__PURE__ */ u$1("path", { d: "m6 9 6 6 6-6" })
                        }
                      )
                    }
                  )
                ] })
              ]
            },
            item.id
          );
        }) })
      ] }) }),
      error && /* @__PURE__ */ u$1("div", { className: "fb-text-red-500 fb-mt-2 fb-text-sm", children: error })
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
      !isFirstQuestion && /* @__PURE__ */ u$1(
        BackButton,
        {
          backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
          tabIndex: question.choices.length + 3,
          onClick: () => {
            const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
            setTtc(updatedTtcObj);
            onBack();
          }
        }
      ),
      /* @__PURE__ */ u$1("div", {}),
      /* @__PURE__ */ u$1(
        SubmitButton,
        {
          tabIndex: question.choices.length + 2,
          buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
          isLastQuestion
        }
      )
    ] })
  ] });
};
const TiredFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m21.88 23.92c5.102-0.06134 7.273-1.882 8.383-3.346"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m46.24 47.56c0-2.592-2.867-7.121-10.25-6.93-6.974 0.1812-10.22 4.518-10.22 7.111s4.271-1.611 10.05-1.492c6.317 0.13 10.43 3.903 10.43 1.311z"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m23.16 28.47c5.215 1.438 5.603 0.9096 8.204 1.207 1.068 0.1221-2.03 2.67-7.282 4.397"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m50.12 23.92c-5.102-0.06134-7.273-1.882-8.383-3.346"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m48.84 28.47c-5.215 1.438-5.603 0.9096-8.204 1.207-1.068 0.1221 2.03 2.67 7.282 4.397"
      }
    )
  ] }) });
};
const WearyFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m22.88 23.92c5.102-0.06134 7.273-1.882 8.383-3.346"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m46.24 47.56c0-2.592-2.867-7.121-10.25-6.93-6.974 0.1812-10.22 4.518-10.22 7.111s4.271-1.611 10.05-1.492c6.317 0.13 10.43 3.903 10.43 1.311z"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m49.12 23.92c-5.102-0.06134-7.273-1.882-8.383-3.346"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m48.24 30.51c-6.199 1.47-7.079 1.059-8.868-1.961"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "m23.76 30.51c6.199 1.47 7.079 1.059 8.868-1.961"
      }
    )
  ] }) });
};
const PerseveringFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "line",
      {
        x1: "44.5361",
        x2: "50.9214",
        y1: "21.4389",
        y2: "24.7158",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ u$1(
      "line",
      {
        x1: "26.9214",
        x2: "20.5361",
        y1: "21.4389",
        y2: "24.7158",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M24,28c2.3334,1.3333,4.6666,2.6667,7,4c-2.3334,1.3333-4.6666,2.6667-7,4"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M48,28c-2.3334,1.3333-4.6666,2.6667-7,4c2.3334,1.3333,4.6666,2.6667,7,4"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M28,51c0.2704-0.3562,1-8,8.4211-8.0038C43,42.9929,43.6499,50.5372,44,51C38.6667,51,33.3333,51,28,51z"
      }
    )
  ] }) });
};
const FrowningFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M26.5,48c1.8768-3.8326,5.8239-6.1965,10-6c3.8343,0.1804,7.2926,2.4926,9,6"
      }
    ),
    /* @__PURE__ */ u$1("path", { d: "M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" }),
    /* @__PURE__ */ u$1("path", { d: "M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" })
  ] }) });
};
const ConfusedFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "m44.7 43.92c-6.328-1.736-11.41-0.906-17.4 1.902"
      }
    ),
    /* @__PURE__ */ u$1("path", { d: "M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" }),
    /* @__PURE__ */ u$1("path", { d: "M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" })
  ] }) });
};
const NeutralFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "line",
      {
        x1: "27",
        x2: "45",
        y1: "43",
        y2: "43",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2"
      }
    ),
    /* @__PURE__ */ u$1("path", { d: "M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" }),
    /* @__PURE__ */ u$1("path", { d: "M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" })
  ] }) });
};
const SlightlySmilingFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M45.8149,44.9293 c-2.8995,1.6362-6.2482,2.5699-9.8149,2.5699s-6.9153-0.9336-9.8149-2.5699"
      }
    ),
    /* @__PURE__ */ u$1("path", { d: "M30,31c0,1.6568-1.3448,3-3,3c-1.6553,0-3-1.3433-3-3c0-1.6552,1.3447-3,3-3C28.6552,28,30,29.3448,30,31" }),
    /* @__PURE__ */ u$1("path", { d: "M48,31c0,1.6568-1.3447,3-3,3s-3-1.3433-3-3c0-1.6552,1.3447-3,3-3S48,29.3448,48,31" })
  ] }) });
};
const SmilingFaceWithSmilingEyes = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M45.8147,45.2268a15.4294,15.4294,0,0,1-19.6294,0"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M31.6941,33.4036a4.7262,4.7262,0,0,0-8.6382,0"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M48.9441,33.4036a4.7262,4.7262,0,0,0-8.6382,0"
      }
    )
  ] }) });
};
const GrinningFaceWithSmilingEyes = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M50.595,41.64a11.5554,11.5554,0,0,1-.87,4.49c-12.49,3.03-25.43.34-27.49-.13a11.4347,11.4347,0,0,1-.83-4.36h.11s14.8,3.59,28.89.07Z"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M49.7251,46.13c-1.79,4.27-6.35,7.23-13.69,7.23-7.41,0-12.03-3.03-13.8-7.36C24.2951,46.47,37.235,49.16,49.7251,46.13Z"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M31.6941,32.4036a4.7262,4.7262,0,0,0-8.6382,0"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeMiterlimit: "10",
        strokeWidth: "2",
        d: "M48.9441,32.4036a4.7262,4.7262,0,0,0-8.6382,0"
      }
    )
  ] }) });
};
const GrinningSquintingFace = (props) => {
  return /* @__PURE__ */ u$1("svg", { viewBox: "0 0 72 72", xmlns: "http://www.w3.org/2000/svg", children: /* @__PURE__ */ u$1("g", { id: "line", children: [
    /* @__PURE__ */ u$1(
      "circle",
      {
        cx: "36",
        cy: "36",
        r: "23",
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        ...props
      }
    ),
    /* @__PURE__ */ u$1(
      "polyline",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        points: "25.168 27.413 31.755 31.427 25.168 35.165"
      }
    ),
    /* @__PURE__ */ u$1(
      "polyline",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        points: "46.832 27.413 40.245 31.427 46.832 35.165"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M50.595,41.64a11.5554,11.5554,0,0,1-.87,4.49c-12.49,3.03-25.43.34-27.49-.13a11.4347,11.4347,0,0,1-.83-4.36h.11s14.8,3.59,28.89.07Z"
      }
    ),
    /* @__PURE__ */ u$1(
      "path",
      {
        fill: "none",
        stroke: "currentColor",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokeWidth: "2",
        d: "M49.7251,46.13c-1.79,4.27-6.35,7.23-13.69,7.23-7.41,0-12.03-3.03-13.8-7.36C24.2951,46.47,37.235,49.16,49.7251,46.13Z"
      }
    )
  ] }) });
};
const RatingQuestion = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  currentQuestionId
}) => {
  const [hoveredNumber, setHoveredNumber] = h(0);
  const [startTime, setStartTime] = h(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);
  const handleSelect = (number2) => {
    onChange({ [question.id]: number2 });
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    setTimeout(() => {
      onSubmit(
        {
          [question.id]: number2
        },
        updatedTtcObj
      );
    }, 250);
  };
  const HiddenRadioInput = ({ number: number2, id }) => /* @__PURE__ */ u$1(
    "input",
    {
      type: "radio",
      id,
      name: "rating",
      value: number2,
      className: "fb-invisible fb-absolute fb-left-0 fb-h-full fb-w-full fb-cursor-pointer fb-opacity-0",
      onClick: () => handleSelect(number2),
      required: question.required,
      checked: value === number2
    }
  );
  y(() => {
    setHoveredNumber(0);
  }, [question.id, setHoveredNumber]);
  const getRatingNumberOptionColor = (range, idx) => {
    if (range > 5) {
      if (range - idx < 2) return "fb-bg-emerald-100";
      if (range - idx < 4) return "fb-bg-orange-100";
      return "fb-bg-rose-100";
    } else if (range < 5) {
      if (range - idx < 1) return "fb-bg-emerald-100";
      if (range - idx < 2) return "fb-bg-orange-100";
      return "fb-bg-rose-100";
    } else {
      if (range - idx < 2) return "fb-bg-emerald-100";
      if (range - idx < 3) return "fb-bg-orange-100";
      return "fb-bg-rose-100";
    }
  };
  return /* @__PURE__ */ u$1(
    "form",
    {
      onSubmit: (e2) => {
        e2.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      },
      className: "fb-w-full",
      children: [
        /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
          isMediaAvailable && /* @__PURE__ */ u$1(QuestionMedia, { imgUrl: question.imageUrl, videoUrl: question.videoUrl }),
          /* @__PURE__ */ u$1(
            Headline,
            {
              headline: getLocalizedValue(question.headline, languageCode),
              questionId: question.id,
              required: question.required
            }
          ),
          /* @__PURE__ */ u$1(
            Subheader,
            {
              subheader: question.subheader ? getLocalizedValue(question.subheader, languageCode) : "",
              questionId: question.id
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mb-4 fb-mt-6 fb-flex fb-items-center fb-justify-center", children: /* @__PURE__ */ u$1("fieldset", { className: "fb-w-full", children: [
            /* @__PURE__ */ u$1("legend", { className: "fb-sr-only", children: "Choices" }),
            /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full", children: Array.from({ length: question.range }, (_2, i2) => i2 + 1).map((number2, i2, a2) => /* @__PURE__ */ u$1(
              "span",
              {
                onMouseOver: () => setHoveredNumber(number2),
                onMouseLeave: () => setHoveredNumber(0),
                className: "fb-bg-survey-bg fb-flex-1 fb-text-center fb-text-sm",
                children: question.scale === "number" ? /* @__PURE__ */ u$1(
                  "label",
                  {
                    tabIndex: i2 + 1,
                    onKeyDown: (e2) => {
                      var _a2, _b;
                      if (e2.key === " ") {
                        e2.preventDefault();
                        (_a2 = document.getElementById(number2.toString())) == null ? void 0 : _a2.click();
                        (_b = document.getElementById(number2.toString())) == null ? void 0 : _b.focus();
                      }
                    },
                    className: cn(
                      value === number2 ? "fb-bg-accent-selected-bg fb-border-border-highlight fb-z-10 fb-border" : "fb-border-border",
                      a2.length === number2 ? "fb-rounded-r-custom fb-border-r" : "",
                      number2 === 1 ? "fb-rounded-l-custom" : "",
                      hoveredNumber === number2 ? "fb-bg-accent-bg" : "",
                      question.isColorCodingEnabled ? "fb-min-h-[47px]" : "fb-min-h-[41px]",
                      "fb-text-heading focus:fb-border-brand fb-relative fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-justify-center fb-overflow-hidden fb-border-b fb-border-l fb-border-t focus:fb-border-2 focus:fb-outline-none"
                    ),
                    children: [
                      question.isColorCodingEnabled && /* @__PURE__ */ u$1(
                        "div",
                        {
                          className: `fb-absolute fb-left-0 fb-top-0 fb-h-[6px] fb-w-full ${getRatingNumberOptionColor(question.range, number2)}`
                        }
                      ),
                      /* @__PURE__ */ u$1(HiddenRadioInput, { number: number2, id: number2.toString() }),
                      number2
                    ]
                  }
                ) : question.scale === "star" ? /* @__PURE__ */ u$1(
                  "label",
                  {
                    tabIndex: i2 + 1,
                    onKeyDown: (e2) => {
                      var _a2, _b;
                      if (e2.key === " ") {
                        e2.preventDefault();
                        (_a2 = document.getElementById(number2.toString())) == null ? void 0 : _a2.click();
                        (_b = document.getElementById(number2.toString())) == null ? void 0 : _b.focus();
                      }
                    },
                    className: cn(
                      number2 <= hoveredNumber || number2 <= value ? "fb-text-amber-400" : "fb-text-[#8696AC]",
                      hoveredNumber === number2 ? "fb-text-amber-400" : "",
                      "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-cursor-pointer fb-justify-center focus:fb-outline-none"
                    ),
                    onFocus: () => setHoveredNumber(number2),
                    onBlur: () => setHoveredNumber(0),
                    children: [
                      /* @__PURE__ */ u$1(HiddenRadioInput, { number: number2, id: number2.toString() }),
                      /* @__PURE__ */ u$1("div", { className: "fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain", children: /* @__PURE__ */ u$1("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ u$1(
                        "path",
                        {
                          fillRule: "evenodd",
                          d: "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                        }
                      ) }) })
                    ]
                  }
                ) : /* @__PURE__ */ u$1(
                  "label",
                  {
                    className: cn(
                      "fb-relative fb-flex fb-max-h-16 fb-min-h-9 fb-w-full fb-cursor-pointer fb-justify-center",
                      value === number2 || hoveredNumber === number2 ? "fb-stroke-rating-selected fb-text-rating-selected" : "fb-stroke-heading fb-text-heading focus:fb-border-accent-bg focus:fb-border-2 focus:fb-outline-none"
                    ),
                    tabIndex: i2 + 1,
                    onKeyDown: (e2) => {
                      var _a2, _b;
                      if (e2.key === " ") {
                        e2.preventDefault();
                        (_a2 = document.getElementById(number2.toString())) == null ? void 0 : _a2.click();
                        (_b = document.getElementById(number2.toString())) == null ? void 0 : _b.focus();
                      }
                    },
                    onFocus: () => setHoveredNumber(number2),
                    onBlur: () => setHoveredNumber(0),
                    children: [
                      /* @__PURE__ */ u$1(HiddenRadioInput, { number: number2, id: number2.toString() }),
                      /* @__PURE__ */ u$1("div", { className: cn("fb-h-full fb-w-full fb-max-w-[74px] fb-object-contain"), children: /* @__PURE__ */ u$1(
                        RatingSmiley,
                        {
                          active: value === number2 || hoveredNumber === number2,
                          idx: i2,
                          range: question.range,
                          addColors: question.isColorCodingEnabled
                        }
                      ) })
                    ]
                  }
                )
              },
              number2
            )) }),
            /* @__PURE__ */ u$1("div", { className: "fb-text-subheading fb-mt-4 fb-flex fb-justify-between fb-px-1.5 fb-text-xs fb-leading-6", children: [
              /* @__PURE__ */ u$1("p", { className: "fb-w-1/2 fb-text-left", dir: "auto", children: getLocalizedValue(question.lowerLabel, languageCode) }),
              /* @__PURE__ */ u$1("p", { className: "fb-w-1/2 fb-text-right", dir: "auto", children: getLocalizedValue(question.upperLabel, languageCode) })
            ] })
          ] }) })
        ] }) }),
        /* @__PURE__ */ u$1("div", { className: "fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4", children: [
          !isFirstQuestion && /* @__PURE__ */ u$1(
            BackButton,
            {
              tabIndex: !question.required || value ? question.range + 2 : question.range + 1,
              backButtonLabel: getLocalizedValue(question.backButtonLabel, languageCode),
              onClick: () => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }
            }
          ),
          /* @__PURE__ */ u$1("div", {}),
          !question.required && /* @__PURE__ */ u$1(
            SubmitButton,
            {
              tabIndex: question.range + 1,
              buttonLabel: getLocalizedValue(question.buttonLabel, languageCode),
              isLastQuestion
            }
          )
        ] })
      ]
    },
    question.id
  );
};
const getSmileyColor = (range, idx) => {
  if (range > 5) {
    if (range - idx < 3) return "fb-fill-emerald-100";
    if (range - idx < 5) return "fb-fill-orange-100";
    return "fb-fill-rose-100";
  } else if (range < 5) {
    if (range - idx < 2) return "fb-fill-emerald-100";
    if (range - idx < 3) return "fb-fill-orange-100";
    return "fb-fill-rose-100";
  } else {
    if (range - idx < 3) return "fb-fill-emerald-100";
    if (range - idx < 4) return "fb-fill-orange-100";
    return "fb-fill-rose-100";
  }
};
const getActiveSmileyColor = (range, idx) => {
  if (range > 5) {
    if (range - idx < 3) return "fb-fill-emerald-300";
    if (range - idx < 5) return "fb-fill-orange-300";
    return "fb-fill-rose-300";
  } else if (range < 5) {
    if (range - idx < 2) return "fb-fill-emerald-300";
    if (range - idx < 3) return "fb-fill-orange-300";
    return "fb-fill-rose-300";
  } else {
    if (range - idx < 3) return "fb-fill-emerald-300";
    if (range - idx < 4) return "fb-fill-orange-300";
    return "fb-fill-rose-300";
  }
};
const getSmiley = (iconIdx, idx, range, active, addColors) => {
  const activeColor = addColors ? getActiveSmileyColor(range, idx) : "fb-fill-rating-fill";
  const inactiveColor = addColors ? getSmileyColor(range, idx) : "fb-fill-none";
  const icons = [
    /* @__PURE__ */ u$1(TiredFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(WearyFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(PerseveringFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(FrowningFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(ConfusedFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(NeutralFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(SlightlySmilingFace, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(SmilingFaceWithSmilingEyes, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(GrinningFaceWithSmilingEyes, { className: active ? activeColor : inactiveColor }),
    /* @__PURE__ */ u$1(GrinningSquintingFace, { className: active ? activeColor : inactiveColor })
  ];
  return icons[iconIdx];
};
const RatingSmiley = ({ active, idx, range, addColors = false }) => {
  let iconsIdx = [];
  if (range === 10) iconsIdx = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  else if (range === 7) iconsIdx = [1, 3, 4, 5, 6, 8, 9];
  else if (range === 5) iconsIdx = [3, 4, 5, 6, 7];
  else if (range === 4) iconsIdx = [4, 5, 6, 7];
  else if (range === 3) iconsIdx = [4, 5, 7];
  return getSmiley(iconsIdx[idx], idx, range, active, addColors);
};
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k2) => typeof obj[obj[k2]] !== "number");
    const filtered = {};
    for (const k2 of validKeys) {
      filtered[k2] = obj[k2];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e2) {
      return obj[e2];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys2 = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys2.push(key);
      }
    }
    return keys2;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_2, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t2 = typeof data;
  switch (t2) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
const quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
class ZodError extends Error {
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  get errors() {
    return this.issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i2 = 0;
          while (i2 < issue.path.length) {
            const el = issue.path[i2];
            const terminal = i2 === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i2++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m2) => !!m2).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
const EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      ctx.schemaErrorMap,
      overrideMap,
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x2) => !!x2)
  });
  ctx.common.issues.push(issue);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s2 of results) {
      if (s2.status === "aborted")
        return INVALID;
      if (s2.status === "dirty")
        status.dirty();
      arrayValue.push(s2.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x2) => x2.status === "aborted";
const isDirty = (x2) => x2.status === "dirty";
const isValid = (x2) => x2.status === "valid";
const isAsync = (x2) => typeof Promise !== "undefined" && x2 instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f2) {
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f2) {
  if (typeof state === "function" ? receiver !== state || !f2 : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return state.set(receiver, value), value;
}
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e2 = new Error(message);
  return e2.name = "SuppressedError", e2.error = error, e2.suppressed = suppressed, e2;
};
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache, _ZodNativeEnum_cache;
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a2, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a2 = message !== null && message !== void 0 ? message : required_error) !== null && _a2 !== void 0 ? _a2 : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
class ZodType {
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
  }
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a2;
    const ctx = {
      common: {
        issues: [],
        async: (_a2 = params === null || params === void 0 ? void 0 : params.async) !== null && _a2 !== void 0 ? _a2 : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this, this._def);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target2) {
    return ZodPipeline.create(this, target2);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6Regex = /^(([a-f0-9]{1,4}:){7}|::([a-f0-9]{1,4}:){0,6}|([a-f0-9]{1,4}:){1}:([a-f0-9]{1,4}:){0,5}|([a-f0-9]{1,4}:){2}:([a-f0-9]{1,4}:){0,4}|([a-f0-9]{1,4}:){3}:([a-f0-9]{1,4}:){0,3}|([a-f0-9]{1,4}:){4}:([a-f0-9]{1,4}:){0,2}|([a-f0-9]{1,4}:){5}:([a-f0-9]{1,4}:){0,1})([a-f0-9]{1,4}|(((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2}))\.){3}((25[0-5])|(2[0-4][0-9])|(1[0-9]{2})|([0-9]{1,2})))$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a2) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  ip(options2) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options2) });
  }
  datetime(options2) {
    var _a2, _b;
    if (typeof options2 === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options2
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options2 === null || options2 === void 0 ? void 0 : options2.precision) === "undefined" ? null : options2 === null || options2 === void 0 ? void 0 : options2.precision,
      offset: (_a2 = options2 === null || options2 === void 0 ? void 0 : options2.offset) !== null && _a2 !== void 0 ? _a2 : false,
      local: (_b = options2 === null || options2 === void 0 ? void 0 : options2.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options2 === null || options2 === void 0 ? void 0 : options2.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options2) {
    if (typeof options2 === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options2
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options2 === null || options2 === void 0 ? void 0 : options2.precision) === "undefined" ? null : options2 === null || options2 === void 0 ? void 0 : options2.precision,
      ...errorUtil.errToObj(options2 === null || options2 === void 0 ? void 0 : options2.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options2) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options2 === null || options2 === void 0 ? void 0 : options2.position,
      ...errorUtil.errToObj(options2 === null || options2 === void 0 ? void 0 : options2.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * @deprecated Use z.string().min(1) instead.
   * @see {@link ZodString.min}
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  var _a2;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a2 = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a2 !== void 0 ? _a2 : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = BigInt(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  var _a2;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a2 = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a2 !== void 0 ? _a2 : false,
    ...processCreateParams(params)
  });
};
class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i2) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i2) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i2));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys2 = util.objectKeys(shape);
    return this._cached = { shape, keys: keys2 };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a2, _b, _c, _d;
          const defaultError = (_c = (_b = (_a2 = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a2, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options2 = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options2.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options2) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
const getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options2, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options2) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options: options2,
      optionsMap,
      ...processCreateParams(params)
    });
  }
}
function mergeValues(a2, b2) {
  const aType = getParsedType(a2);
  const bType = getParsedType(b2);
  if (a2 === b2) {
    return { valid: true, data: a2 };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b2);
    const sharedKeys = util.objectKeys(a2).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a2, ...b2 };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a2[key], b2[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a2.length !== b2.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a2.length; index++) {
      const itemA = a2[index];
      const itemB = b2[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a2 === +b2) {
    return { valid: true, data: a2 };
  } else {
    return { valid: false };
  }
}
class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x2) => !!x2);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}
class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i2) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i2)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x2) => !!x2),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x2) => !!x2),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn2 = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e2) => {
          error.addIssue(makeArgsIssue(args, e2));
          throw error;
        });
        const result = await Reflect.apply(fn2, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e2) => {
          error.addIssue(makeReturnsIssue(result, e2));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn2, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}
class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
class ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache)) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values));
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache).has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache)) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)));
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache).has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
const BRAND = Symbol("zod_brand");
class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a2, b2) {
    return new ZodPipeline({
      in: a2,
      out: b2,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function custom(check, params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a2, _b;
      if (!check(data)) {
        const p2 = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
        const _fatal = (_b = (_a2 = p2.fatal) !== null && _a2 !== void 0 ? _a2 : fatal) !== null && _b !== void 0 ? _b : true;
        const p22 = typeof p2 === "string" ? { message: p2 } : p2;
        ctx.addIssue({ code: "custom", ...p22, fatal: _fatal });
      }
    });
  return ZodAny.create();
}
const late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const nanType = ZodNaN.create;
const bigIntType = ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
const symbolType = ZodSymbol.create;
const undefinedType = ZodUndefined.create;
const nullType = ZodNull.create;
const anyType = ZodAny.create;
const unknownType = ZodUnknown.create;
const neverType = ZodNever.create;
const voidType = ZodVoid.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const strictObjectType = ZodObject.strictCreate;
const unionType = ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
const intersectionType = ZodIntersection.create;
const tupleType = ZodTuple.create;
const recordType = ZodRecord.create;
const mapType = ZodMap.create;
const setType = ZodSet.create;
const functionType = ZodFunction.create;
const lazyType = ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;
const nativeEnumType = ZodNativeEnum.create;
const promiseType = ZodPromise.create;
const effectsType = ZodEffects.create;
const optionalType = ZodOptional.create;
const nullableType = ZodNullable.create;
const preprocessType = ZodEffects.createWithPreprocess;
const pipelineType = ZodPipeline.create;
const ostring = () => stringType().optional();
const onumber = () => numberType().optional();
const oboolean = () => booleanType().optional();
const coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
const NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});
z.union([
  z.literal("exactMatch"),
  z.literal("contains"),
  z.literal("startsWith"),
  z.literal("endsWith"),
  z.literal("notMatch"),
  z.literal("notContains")
]);
const ZActionClassPageUrlRule = z.union([
  z.literal("exactMatch"),
  z.literal("contains"),
  z.literal("startsWith"),
  z.literal("endsWith"),
  z.literal("notMatch"),
  z.literal("notContains")
]);
const ZActionClassNoCodeConfigBase = z.object({
  type: z.enum(["click", "pageView", "exitIntent", "fiftyPercentScroll"]),
  urlFilters: z.array(
    z.object({
      value: z.string().trim().min(1, { message: "Value must contain atleast 1 character" }),
      rule: ZActionClassPageUrlRule
    })
  )
});
const ZActionClassNoCodeConfigClick = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("click"),
  elementSelector: z.object({
    cssSelector: z.string().trim().optional(),
    innerHtml: z.string().trim().optional()
  }).superRefine((data, ctx) => {
    if (!data.cssSelector && !data.innerHtml) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Either cssSelector or innerHtml must be provided`
      });
    }
  })
});
const ZActionClassNoCodeConfigPageView = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("pageView")
});
const ZActionClassNoCodeConfigExitIntent = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("exitIntent")
});
const ZActionClassNoCodeConfigfiftyPercentScroll = ZActionClassNoCodeConfigBase.extend({
  type: z.literal("fiftyPercentScroll")
});
const ZActionClassNoCodeConfig = z.union([
  ZActionClassNoCodeConfigClick,
  ZActionClassNoCodeConfigPageView,
  ZActionClassNoCodeConfigExitIntent,
  ZActionClassNoCodeConfigfiftyPercentScroll
]);
const ZActionClassType = z.enum(["code", "noCode", "automatic"]);
const ZActionClass = z.object({
  id: z.string().cuid2(),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  type: ZActionClassType,
  key: z.string().trim().min(1).nullable(),
  noCodeConfig: ZActionClassNoCodeConfig.nullable(),
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date()
});
const ZActionClassInputBase = z.object({
  name: z.string({ message: "Name is required" }).trim().min(1, { message: "Name must be at least 1 character long" }),
  description: z.string().nullable(),
  environmentId: z.string(),
  type: ZActionClassType
});
const ZActionClassInputCode = ZActionClassInputBase.extend({
  type: z.literal("code"),
  key: z.string().trim().min(1).nullable()
});
const ZActionClassInputNoCode = ZActionClassInputBase.extend({
  type: z.literal("noCode"),
  noCodeConfig: ZActionClassNoCodeConfig.nullable()
});
const ZActionClassInputAutomatic = ZActionClassInputBase.extend({
  type: z.literal("automatic")
});
z.union([
  ZActionClassInputCode,
  ZActionClassInputNoCode,
  ZActionClassInputAutomatic
]);
z.object({
  environmentId: z.string().cuid2(),
  userId: z.string(),
  attributes: z.record(z.union([z.string(), z.number()]))
});
const ZAttributes = z.record(z.string());
z.string();
z.number();
z.number().optional();
z.string().optional();
const ZColor = z.string().regex(/^#(?:[A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
const ZPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);
const ZAllowedFileExtension = z.enum([
  "png",
  "jpeg",
  "jpg",
  "webp",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "plain",
  "csv",
  "mp4",
  "mov",
  "avi",
  "mkv",
  "webm",
  "zip",
  "rar",
  "7z",
  "tar"
]);
const ZId = z.string().cuid2();
z.string().uuid();
const ZEnvironment = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  type: z.enum(["development", "production"]),
  productId: z.string(),
  appSetupCompleted: z.boolean()
});
z.object({
  id: z.string()
});
z.object({
  type: z.enum(["development", "production"]),
  productId: z.string(),
  appSetupCompleted: z.boolean()
});
z.object({
  type: z.enum(["development", "production"]).optional(),
  appSetupCompleted: z.boolean().optional()
});
const ZStylingColor = z.object({
  light: ZColor,
  dark: ZColor.nullish()
});
const ZCardArrangementOptions = z.enum(["casual", "straight", "simple"]);
const ZCardArrangement = z.object({
  linkSurveys: ZCardArrangementOptions,
  appSurveys: ZCardArrangementOptions
});
const ZSurveyStylingBackground = z.object({
  bg: z.string().nullish(),
  bgType: z.enum(["animation", "color", "image", "upload"]).nullish(),
  brightness: z.number().nullish()
}).refine(
  (surveyBackground) => {
    if (surveyBackground.bgType === "upload") {
      return Boolean(surveyBackground.bg);
    }
    return true;
  },
  { message: "Invalid background" }
);
const ZBaseStyling = z.object({
  brandColor: ZStylingColor.nullish(),
  questionColor: ZStylingColor.nullish(),
  inputColor: ZStylingColor.nullish(),
  inputBorderColor: ZStylingColor.nullish(),
  cardBackgroundColor: ZStylingColor.nullish(),
  cardBorderColor: ZStylingColor.nullish(),
  cardShadowColor: ZStylingColor.nullish(),
  highlightBorderColor: ZStylingColor.nullish(),
  isDarkModeEnabled: z.boolean().nullish(),
  roundness: z.number().nullish(),
  cardArrangement: ZCardArrangement.nullish(),
  background: ZSurveyStylingBackground.nullish(),
  hideProgressBar: z.boolean().nullish(),
  isLogoHidden: z.boolean().nullish()
});
const ZProductStyling = ZBaseStyling.extend({
  allowStyleOverwrite: z.boolean()
});
const ZProductConfigIndustry = z.enum(["eCommerce", "saas", "other"]).nullable();
const ZProductConfigChannel = z.enum(["link", "app", "website"]).nullable();
z.enum(["surveys", "cx"]);
const ZProductConfig = z.object({
  channel: ZProductConfigChannel,
  industry: ZProductConfigIndustry
});
const ZLanguage = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  code: z.string(),
  alias: z.string().nullable()
});
z.object({
  code: z.string(),
  alias: z.string().nullable()
});
z.object({
  alias: z.string().nullable()
});
const ZLogo = z.object({
  url: z.string().optional(),
  bgColor: z.string().optional()
});
z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string().trim().min(1, { message: "Product name cannot be empty" }),
  organizationId: z.string(),
  styling: ZProductStyling,
  recontactDays: z.number({ message: "Recontact days is required" }).int().min(0, { message: "Must be a positive number" }).max(365, { message: "Must be less than 365" }),
  inAppSurveyBranding: z.boolean(),
  linkSurveyBranding: z.boolean(),
  config: ZProductConfig,
  placement: ZPlacement,
  clickOutsideClose: z.boolean(),
  darkOverlay: z.boolean(),
  environments: z.array(ZEnvironment),
  languages: z.array(ZLanguage),
  logo: ZLogo.nullish()
});
z.object({
  name: z.string().trim().min(1, { message: "Product name cannot be empty" }).optional(),
  organizationId: z.string().optional(),
  highlightBorderColor: ZColor.nullish(),
  recontactDays: z.number().int().optional(),
  inAppSurveyBranding: z.boolean().optional(),
  linkSurveyBranding: z.boolean().optional(),
  config: ZProductConfig.optional(),
  placement: ZPlacement.optional(),
  clickOutsideClose: z.boolean().optional(),
  darkOverlay: z.boolean().optional(),
  environments: z.array(ZEnvironment).optional(),
  styling: ZProductStyling.optional(),
  logo: ZLogo.optional()
});
const BASE_OPERATORS = [
  "lessThan",
  "lessEqual",
  "greaterThan",
  "greaterEqual",
  "equals",
  "notEquals"
];
const ARITHMETIC_OPERATORS = ["lessThan", "lessEqual", "greaterThan", "greaterEqual"];
const STRING_OPERATORS = ["contains", "doesNotContain", "startsWith", "endsWith"];
z.enum(BASE_OPERATORS);
const ATTRIBUTE_OPERATORS = [
  ...BASE_OPERATORS,
  "isSet",
  "isNotSet",
  "contains",
  "doesNotContain",
  "startsWith",
  "endsWith"
];
const PERSON_OPERATORS = ATTRIBUTE_OPERATORS;
const SEGMENT_OPERATORS = ["userIsIn", "userIsNotIn"];
const DEVICE_OPERATORS = ["equals", "notEquals"];
[...ATTRIBUTE_OPERATORS, ...SEGMENT_OPERATORS];
const ZAttributeOperator = z.enum(ATTRIBUTE_OPERATORS);
const ZPersonOperator = z.enum(PERSON_OPERATORS);
const ZSegmentOperator = z.enum(SEGMENT_OPERATORS);
const ZDeviceOperator = z.enum(DEVICE_OPERATORS);
const ZSegmentFilterValue = z.union([z.string(), z.number()]);
const ZSegmentFilterRootType = z.enum(["attribute", "segment", "device", "person"]);
z.discriminatedUnion("type", [
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.attribute),
    attributeClassId: z.string()
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.person),
    userId: z.string()
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.segment),
    segmentId: z.string()
  }),
  z.object({
    type: z.literal(ZSegmentFilterRootType.Enum.device),
    deviceType: z.string()
  })
]);
const ZSegmentAttributeFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("attribute"),
    attributeClassName: z.string()
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZAttributeOperator
  })
});
const ZSegmentPersonFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("person"),
    personIdentifier: z.string()
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZPersonOperator
  })
});
const ZSegmentSegmentFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("segment"),
    segmentId: z.string()
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZSegmentOperator
  })
});
const ZSegmentDeviceFilter = z.object({
  id: z.string().cuid2(),
  root: z.object({
    type: z.literal("device"),
    deviceType: z.string()
  }),
  value: ZSegmentFilterValue,
  qualifier: z.object({
    operator: ZDeviceOperator
  })
});
const ZSegmentFilter = z.union([ZSegmentAttributeFilter, ZSegmentPersonFilter, ZSegmentSegmentFilter, ZSegmentDeviceFilter]).refine(
  (filter) => {
    if (ARITHMETIC_OPERATORS.includes(filter.qualifier.operator) && typeof filter.value !== "number") {
      return false;
    }
    if (STRING_OPERATORS.includes(filter.qualifier.operator) && typeof filter.value !== "string") {
      return false;
    }
    return true;
  },
  {
    message: "Value must be a string for string operators and a number for arithmetic operators"
  }
).refine(
  (filter) => {
    const { value, qualifier } = filter;
    const { operator } = qualifier;
    if (operator === "isSet" || operator === "isNotSet") {
      return true;
    }
    if (typeof value === "string") {
      return value.length > 0;
    }
    return true;
  },
  {
    message: "Invalid value for filters: please check your filter values"
  }
);
const ZSegmentConnector = z.enum(["and", "or"]).nullable();
const ZBaseFilter = z.lazy(
  () => z.object({
    id: z.string().cuid2(),
    connector: ZSegmentConnector,
    resource: z.union([ZSegmentFilter, ZBaseFilters])
  })
);
const ZBaseFilters = z.lazy(() => z.array(ZBaseFilter));
const refineFilters = (filters) => {
  let result = true;
  for (let i2 = 0; i2 < filters.length; i2++) {
    const group = filters[i2];
    if (Array.isArray(group.resource)) {
      result = refineFilters(group.resource);
    } else if (i2 === 0 && group.connector !== null) {
      result = false;
      break;
    }
  }
  return result;
};
const ZSegmentFilters = z.array(
  z.object({
    id: z.string().cuid2(),
    connector: ZSegmentConnector,
    resource: z.union([ZSegmentFilter, z.lazy(() => ZSegmentFilters)])
  })
).refine(refineFilters, {
  message: "Invalid filters applied"
});
const ZSegment = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().default(true),
  filters: ZSegmentFilters,
  environmentId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  surveys: z.array(z.string())
});
z.object({
  environmentId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  isPrivate: z.boolean().default(true),
  filters: ZSegmentFilters,
  surveyId: z.string()
});
z.object({
  title: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean().default(true),
  filters: ZSegmentFilters,
  surveys: z.array(z.string())
}).partial();
const FORBIDDEN_IDS = [
  "userId",
  "source",
  "suid",
  "end",
  "start",
  "welcomeCard",
  "hidden",
  "verifiedEmail",
  "multiLanguage",
  "embed"
];
const FIELD_TO_LABEL_MAP = {
  headline: "question",
  subheader: "description",
  buttonLabel: "next button label",
  backButtonLabel: "back button label",
  placeholder: "placeholder",
  upperLabel: "upper label",
  lowerLabel: "lower label",
  "consent.label": "checkbox label",
  dismissButtonLabel: "dismiss button label",
  html: "description",
  cardHeadline: "note",
  welcomeCardHtml: "welcome message",
  endingCardButtonLabel: "button label"
};
const extractLanguageCodes = (surveyLanguages) => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map(
    (surveyLanguage) => surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};
const validateLabelForAllLanguages = (label, surveyLanguages) => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);
  const languages = !languageCodes.length ? ["default"] : languageCodes;
  const invalidLanguageCodes = languages.filter(
    (language) => !label[language] || label[language].trim() === ""
  );
  return invalidLanguageCodes.map((invalidLanguageCode) => {
    var _a2;
    if (invalidLanguageCode === "default") {
      return ((_a2 = surveyLanguages.find((lang) => lang.default)) == null ? void 0 : _a2.language.code) ?? "default";
    }
    return invalidLanguageCode;
  });
};
const validateQuestionLabels = (field, fieldLabel, languages, questionIndex, skipArticle = false) => {
  for (const language of languages) {
    if (!language.default && // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
    fieldLabel[language.language.code] === void 0) {
      return {
        code: z.ZodIssueCode.custom,
        message: `The ${field} in question ${String(questionIndex + 1)} is not present for the following languages: ${language.language.code}`,
        path: ["questions", questionIndex, field]
      };
    }
  }
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultOnly ? " is missing" : " is missing for the following languages: ";
  const message = isDefaultOnly ? `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix}` : `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix} -fLang- ${invalidLanguageCodes.join()}`;
  if (invalidLanguageCodes.length) {
    return {
      code: z.ZodIssueCode.custom,
      message,
      path: ["questions", questionIndex, field],
      params: isDefaultOnly ? void 0 : { invalidLanguageCodes }
    };
  }
  return null;
};
const validateCardFieldsForAllLanguages = (field, fieldLabel, languages, cardType, endingCardIndex, skipArticle = false) => {
  const cardTypeLabel = cardType === "welcome" ? "Welcome card" : `Ending card ${((endingCardIndex ?? -1) + 1).toString()}`;
  const path = cardType === "welcome" ? ["welcomeCard", field] : ["endings", endingCardIndex ?? -1, field];
  for (const language of languages) {
    if (!language.default && // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
    fieldLabel[language.language.code] === void 0) {
      return {
        code: z.ZodIssueCode.custom,
        message: `The ${field} in ${cardTypeLabel} is not present for the following languages: ${language.language.code}`,
        path
      };
    }
  }
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultOnly ? " is missing" : " is missing for the following languages: ";
  const message = isDefaultOnly ? `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix}` : `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix} -fLang- ${invalidLanguageCodes.join(", ")}`;
  if (invalidLanguageCodes.length) {
    return {
      code: z.ZodIssueCode.custom,
      message,
      path,
      params: isDefaultOnly ? void 0 : { invalidLanguageCodes }
    };
  }
  return null;
};
const findLanguageCodesForDuplicateLabels = (labels, surveyLanguages) => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);
  const languagesToCheck = languageCodes.length === 0 ? ["default"] : languageCodes;
  const duplicateLabels = /* @__PURE__ */ new Set();
  for (const language of languagesToCheck) {
    const labelTexts = labels.map((label) => label[language].trim()).filter(Boolean);
    const uniqueLabels = new Set(labelTexts);
    if (uniqueLabels.size !== labelTexts.length) {
      duplicateLabels.add(language);
    }
  }
  return Array.from(duplicateLabels);
};
const findQuestionsWithCyclicLogic = (questions) => {
  const visited = {};
  const recStack = {};
  const cyclicQuestions = /* @__PURE__ */ new Set();
  const checkForCyclicLogic = (questionId) => {
    if (!visited[questionId]) {
      visited[questionId] = true;
      recStack[questionId] = true;
      const question = questions.find((ques) => ques.id === questionId);
      if ((question == null ? void 0 : question.logic) && question.logic.length > 0) {
        for (const logic of question.logic) {
          const jumpActions = findJumpToQuestionActions(logic.actions);
          for (const jumpAction of jumpActions) {
            const destination = jumpAction.target;
            if (!visited[destination] && checkForCyclicLogic(destination)) {
              cyclicQuestions.add(questionId);
              return true;
            } else if (recStack[destination]) {
              cyclicQuestions.add(questionId);
              return true;
            }
          }
        }
      }
      const nextQuestionIndex = questions.findIndex((ques) => ques.id === questionId) + 1;
      const nextQuestion = questions[nextQuestionIndex];
      if (nextQuestion && !visited[nextQuestion.id] && checkForCyclicLogic(nextQuestion.id)) {
        return true;
      }
    }
    recStack[questionId] = false;
    return false;
  };
  for (const question of questions) {
    checkForCyclicLogic(question.id);
  }
  return Array.from(cyclicQuestions);
};
const findJumpToQuestionActions = (actions) => {
  return actions.filter((action) => action.objective === "jumpToQuestion");
};
const isConditionGroup$1 = (condition) => {
  return "conditions" in condition;
};
const ZI18nString = z.record(z.string()).refine((obj) => "default" in obj, {
  message: "Object must have a 'default' key"
});
const ZSurveyEndingBase = z.object({
  id: z.string().cuid2()
});
const ZSurveyEndScreenCard = ZSurveyEndingBase.extend({
  type: z.literal("endScreen"),
  headline: ZI18nString.optional(),
  subheader: ZI18nString.optional(),
  buttonLabel: ZI18nString.optional(),
  buttonLink: z.string().url("Invalid Button Url in Ending card").optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional()
});
const ZSurveyRedirectUrlCard = ZSurveyEndingBase.extend({
  type: z.literal("redirectToUrl"),
  url: z.string().url("Invalid Redirect Url in Ending card").optional(),
  label: z.string().optional()
});
const ZSurveyEnding = z.union([ZSurveyEndScreenCard, ZSurveyRedirectUrlCard]);
const ZSurveyEndings = z.array(ZSurveyEnding);
var TSurveyQuestionTypeEnum = /* @__PURE__ */ ((TSurveyQuestionTypeEnum2) => {
  TSurveyQuestionTypeEnum2["FileUpload"] = "fileUpload";
  TSurveyQuestionTypeEnum2["OpenText"] = "openText";
  TSurveyQuestionTypeEnum2["MultipleChoiceSingle"] = "multipleChoiceSingle";
  TSurveyQuestionTypeEnum2["MultipleChoiceMulti"] = "multipleChoiceMulti";
  TSurveyQuestionTypeEnum2["NPS"] = "nps";
  TSurveyQuestionTypeEnum2["CTA"] = "cta";
  TSurveyQuestionTypeEnum2["Rating"] = "rating";
  TSurveyQuestionTypeEnum2["Consent"] = "consent";
  TSurveyQuestionTypeEnum2["PictureSelection"] = "pictureSelection";
  TSurveyQuestionTypeEnum2["Cal"] = "cal";
  TSurveyQuestionTypeEnum2["Date"] = "date";
  TSurveyQuestionTypeEnum2["Matrix"] = "matrix";
  TSurveyQuestionTypeEnum2["Address"] = "address";
  TSurveyQuestionTypeEnum2["Ranking"] = "ranking";
  TSurveyQuestionTypeEnum2["ContactInfo"] = "contactInfo";
  return TSurveyQuestionTypeEnum2;
})(TSurveyQuestionTypeEnum || {});
const ZSurveyQuestionId = z.string().superRefine((id, ctx) => {
  if (FORBIDDEN_IDS.includes(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Question id is not allowed`
    });
  }
  if (id.includes(" ")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question id not allowed, avoid using spaces."
    });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Question id not allowed, use only alphanumeric characters, hyphens, or underscores."
    });
  }
});
const ZSurveyWelcomeCard = z.object({
  enabled: z.boolean(),
  headline: ZI18nString.optional(),
  html: ZI18nString.optional(),
  fileUrl: z.string().optional(),
  buttonLabel: ZI18nString.optional(),
  timeToFinish: z.boolean().default(true),
  showResponseCount: z.boolean().default(false),
  videoUrl: z.string().optional()
}).refine((schema) => !(schema.enabled && !schema.headline), {
  message: "Welcome card must have a headline"
});
const ZSurveyHiddenFields = z.object({
  enabled: z.boolean(),
  fieldIds: z.optional(
    z.array(
      z.string().superRefine((field, ctx) => {
        if (FORBIDDEN_IDS.includes(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Hidden field id is not allowed`
          });
        }
        if (field.includes(" ")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hidden field id not allowed, avoid using spaces."
          });
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Hidden field id not allowed, use only alphanumeric characters, hyphens, or underscores."
          });
        }
      })
    )
  )
});
const ZSurveyVariable = z.discriminatedUnion("type", [
  z.object({
    id: z.string().cuid2(),
    name: z.string(),
    type: z.literal("number"),
    value: z.number().default(0)
  }),
  z.object({
    id: z.string().cuid2(),
    name: z.string(),
    type: z.literal("text"),
    value: z.string().default("")
  })
]).superRefine((data, ctx) => {
  if (!/^[a-z0-9_]+$/.test(data.name)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Variable name can only contain lowercase letters, numbers, and underscores",
      path: ["variables"]
    });
  }
});
const ZSurveyVariables = z.array(ZSurveyVariable);
const ZSurveyProductOverwrites = z.object({
  brandColor: ZColor.nullish(),
  highlightBorderColor: ZColor.nullish(),
  placement: ZPlacement.nullish(),
  clickOutsideClose: z.boolean().nullish(),
  darkOverlay: z.boolean().nullish()
});
z.enum(["animation", "color", "upload", "image"]);
const ZSurveyStyling = ZBaseStyling.extend({
  overwriteThemeStyling: z.boolean().nullish()
});
const ZSurveyClosedMessage = z.object({
  enabled: z.boolean().optional(),
  heading: z.string().optional(),
  subheading: z.string().optional()
}).nullable().optional();
const ZSurveySingleUse = z.object({
  enabled: z.boolean(),
  heading: z.optional(z.string()),
  subheading: z.optional(z.string()),
  isEncrypted: z.boolean()
}).nullable();
const ZSurveyQuestionChoice = z.object({
  id: z.string(),
  label: ZI18nString
});
const ZSurveyPictureChoice = z.object({
  id: z.string(),
  imageUrl: z.string()
});
const ZSurveyLogicConditionsOperator = z.enum([
  "equals",
  "doesNotEqual",
  "contains",
  "doesNotContain",
  "startsWith",
  "doesNotStartWith",
  "endsWith",
  "doesNotEndWith",
  "isSubmitted",
  "isSkipped",
  "isGreaterThan",
  "isLessThan",
  "isGreaterThanOrEqual",
  "isLessThanOrEqual",
  "equalsOneOf",
  "includesAllOf",
  "includesOneOf",
  "isClicked",
  "isAccepted",
  "isBefore",
  "isAfter",
  "isBooked",
  "isPartiallySubmitted",
  "isCompletelySubmitted"
]);
const operatorsWithoutRightOperand = [
  ZSurveyLogicConditionsOperator.Enum.isSubmitted,
  ZSurveyLogicConditionsOperator.Enum.isSkipped,
  ZSurveyLogicConditionsOperator.Enum.isClicked,
  ZSurveyLogicConditionsOperator.Enum.isAccepted,
  ZSurveyLogicConditionsOperator.Enum.isBooked,
  ZSurveyLogicConditionsOperator.Enum.isPartiallySubmitted,
  ZSurveyLogicConditionsOperator.Enum.isCompletelySubmitted
];
const ZDynamicLogicField = z.enum(["question", "variable", "hiddenField"]);
const ZActionObjective = z.enum(["calculate", "requireAnswer", "jumpToQuestion"]);
const ZActionTextVariableCalculateOperator = z.enum(["assign", "concat"], {
  message: "Conditional Logic: Invalid operator for a text variable"
});
const ZActionNumberVariableCalculateOperator = z.enum(
  ["add", "subtract", "multiply", "divide", "assign"],
  { message: "Conditional Logic: Invalid operator for a number variable" }
);
const ZDynamicQuestion = z.object({
  type: z.literal("question"),
  value: z.string().min(1, "Conditional Logic: Question id cannot be empty")
});
const ZDynamicVariable = z.object({
  type: z.literal("variable"),
  value: z.string().cuid2({ message: "Conditional Logic: Variable id must be a valid cuid" }).min(1, "Conditional Logic: Variable id cannot be empty")
});
const ZDynamicHiddenField = z.object({
  type: z.literal("hiddenField"),
  value: z.string().min(1, "Conditional Logic: Hidden field id cannot be empty")
});
const ZDynamicLogicFieldValue = z.union([ZDynamicQuestion, ZDynamicVariable, ZDynamicHiddenField], {
  message: "Conditional Logic: Invalid dynamic field value"
});
const ZLeftOperand = ZDynamicLogicFieldValue;
const ZRightOperandStatic = z.object({
  type: z.literal("static"),
  value: z.union([z.string(), z.number(), z.array(z.string())])
});
const ZRightOperand = z.union([ZRightOperandStatic, ZDynamicLogicFieldValue]);
const ZSingleCondition = z.object({
  id: ZId,
  leftOperand: ZLeftOperand,
  operator: ZSurveyLogicConditionsOperator,
  rightOperand: ZRightOperand.optional()
}).and(
  z.object({
    connector: z.undefined()
  })
).superRefine((val, ctx) => {
  if (!operatorsWithoutRightOperand.includes(val.operator)) {
    if (val.rightOperand === void 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: right operand is required for operator "${val.operator}"`,
        path: ["rightOperand"]
      });
    } else if (val.rightOperand.type === "static" && val.rightOperand.value === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: right operand value cannot be empty for operator "${val.operator}"`
      });
    }
  } else if (val.rightOperand !== void 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Conditional Logic: right operand should not be present for operator "${val.operator}"`,
      path: ["rightOperand"]
    });
  }
});
const ZConditionGroup = z.lazy(
  () => z.object({
    id: ZId,
    connector: z.enum(["and", "or"]),
    conditions: z.array(z.union([ZSingleCondition, ZConditionGroup]))
  })
);
z.union([z.literal("static"), ZDynamicLogicField]);
const ZActionBase = z.object({
  id: ZId,
  objective: ZActionObjective
});
const ZActionCalculateBase = ZActionBase.extend({
  objective: z.literal("calculate"),
  variableId: z.string()
});
const ZActionCalculateText = ZActionCalculateBase.extend({
  operator: ZActionTextVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.string({ message: "Conditional Logic: Value must be a string for text variable" }).min(1, "Conditional Logic: Please enter a value in logic field")
    }),
    ZDynamicLogicFieldValue
  ])
});
const ZActionCalculateNumber = ZActionCalculateBase.extend({
  operator: ZActionNumberVariableCalculateOperator,
  value: z.union([
    z.object({
      type: z.literal("static"),
      value: z.number({ message: "Conditional Logic: Value must be a number for number variable" })
    }),
    ZDynamicLogicFieldValue
  ])
}).superRefine((val, ctx) => {
  if (val.operator === "divide" && val.value.type === "static" && val.value.value === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Conditional Logic: Cannot divide by zero",
      path: ["value", "value"]
    });
  }
});
const ZActionCalculate = z.union([ZActionCalculateText, ZActionCalculateNumber]);
const ZActionRequireAnswer = ZActionBase.extend({
  objective: z.literal("requireAnswer"),
  target: z.string().min(1, "Conditional Logic: Target question id cannot be empty")
});
const ZActionJumpToQuestion = ZActionBase.extend({
  objective: z.literal("jumpToQuestion"),
  target: z.string().min(1, "Conditional Logic: Target question id cannot be empty")
});
const ZSurveyLogicAction = z.union([ZActionCalculate, ZActionRequireAnswer, ZActionJumpToQuestion]);
const ZSurveyLogicActions = z.array(ZSurveyLogicAction);
const ZSurveyLogic = z.object({
  id: ZId,
  conditions: ZConditionGroup,
  actions: ZSurveyLogicActions
});
const ZSurveyQuestionBase = z.object({
  id: ZSurveyQuestionId,
  type: z.string(),
  headline: ZI18nString,
  subheader: ZI18nString.optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  required: z.boolean(),
  buttonLabel: ZI18nString.optional(),
  backButtonLabel: ZI18nString.optional(),
  scale: z.enum(["number", "smiley", "star"]).optional(),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]).optional(),
  logic: z.array(ZSurveyLogic).optional(),
  isDraft: z.boolean().optional()
});
const ZSurveyOpenTextQuestionInputType = z.enum(["text", "email", "url", "number", "phone"]);
const ZSurveyOpenTextQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "openText"
    /* OpenText */
  ),
  placeholder: ZI18nString.optional(),
  longAnswer: z.boolean().optional(),
  inputType: ZSurveyOpenTextQuestionInputType.optional().default("text")
});
const ZSurveyConsentQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "consent"
    /* Consent */
  ),
  html: ZI18nString.optional(),
  label: ZI18nString,
  placeholder: z.string().optional()
});
const ZShuffleOption = z.enum(["none", "all", "exceptLast"]);
const ZSurveyMultipleChoiceQuestion = ZSurveyQuestionBase.extend({
  type: z.union([
    z.literal(
      "multipleChoiceSingle"
      /* MultipleChoiceSingle */
    ),
    z.literal(
      "multipleChoiceMulti"
      /* MultipleChoiceMulti */
    )
  ]),
  choices: z.array(ZSurveyQuestionChoice).min(2, { message: "Multiple Choice Question must have at least two choices" }),
  shuffleOption: ZShuffleOption.optional(),
  otherOptionPlaceholder: ZI18nString.optional()
});
const ZSurveyNPSQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "nps"
    /* NPS */
  ),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false)
});
const ZSurveyCTAQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "cta"
    /* CTA */
  ),
  html: ZI18nString.optional(),
  buttonUrl: z.string().optional(),
  buttonExternal: z.boolean(),
  dismissButtonLabel: ZI18nString.optional()
});
const ZSurveyRatingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "rating"
    /* Rating */
  ),
  scale: z.enum(["number", "smiley", "star"]),
  range: z.union([z.literal(5), z.literal(3), z.literal(4), z.literal(7), z.literal(10)]),
  lowerLabel: ZI18nString.optional(),
  upperLabel: ZI18nString.optional(),
  isColorCodingEnabled: z.boolean().optional().default(false)
});
const ZSurveyDateQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "date"
    /* Date */
  ),
  html: ZI18nString.optional(),
  format: z.enum(["M-d-y", "d-M-y", "y-M-d"])
});
const ZSurveyPictureSelectionQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "pictureSelection"
    /* PictureSelection */
  ),
  allowMulti: z.boolean().optional().default(false),
  choices: z.array(ZSurveyPictureChoice).min(2, { message: "Picture Selection question must have atleast 2 choices" })
});
const ZSurveyFileUploadQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "fileUpload"
    /* FileUpload */
  ),
  allowMultipleFiles: z.boolean(),
  maxSizeInMB: z.number().optional(),
  allowedFileExtensions: z.array(ZAllowedFileExtension).optional()
});
const ZSurveyCalQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "cal"
    /* Cal */
  ),
  calUserName: z.string().min(1, { message: "Cal user name is required" }),
  calHost: z.string().optional()
});
const ZSurveyMatrixQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "matrix"
    /* Matrix */
  ),
  rows: z.array(ZI18nString),
  columns: z.array(ZI18nString),
  shuffleOption: ZShuffleOption.optional().default("none")
});
const ZSurveyShowRequiredToggle = z.object({
  show: z.boolean(),
  required: z.boolean()
});
const ZSurveyAddressQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "address"
    /* Address */
  ),
  addressLine1: ZSurveyShowRequiredToggle,
  addressLine2: ZSurveyShowRequiredToggle,
  city: ZSurveyShowRequiredToggle,
  state: ZSurveyShowRequiredToggle,
  zip: ZSurveyShowRequiredToggle,
  country: ZSurveyShowRequiredToggle
});
const ZSurveyContactInfoQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "contactInfo"
    /* ContactInfo */
  ),
  firstName: ZSurveyShowRequiredToggle,
  lastName: ZSurveyShowRequiredToggle,
  email: ZSurveyShowRequiredToggle,
  phone: ZSurveyShowRequiredToggle,
  company: ZSurveyShowRequiredToggle
});
const ZSurveyRankingQuestion = ZSurveyQuestionBase.extend({
  type: z.literal(
    "ranking"
    /* Ranking */
  ),
  choices: z.array(ZSurveyQuestionChoice).min(2, { message: "Ranking Question must have at least two options" }),
  otherOptionPlaceholder: ZI18nString.optional(),
  shuffleOption: ZShuffleOption.optional()
});
const ZSurveyQuestion = z.union([
  ZSurveyOpenTextQuestion,
  ZSurveyConsentQuestion,
  ZSurveyMultipleChoiceQuestion,
  ZSurveyNPSQuestion,
  ZSurveyCTAQuestion,
  ZSurveyRatingQuestion,
  ZSurveyPictureSelectionQuestion,
  ZSurveyDateQuestion,
  ZSurveyFileUploadQuestion,
  ZSurveyCalQuestion,
  ZSurveyMatrixQuestion,
  ZSurveyAddressQuestion,
  ZSurveyRankingQuestion,
  ZSurveyContactInfoQuestion
]);
const ZSurveyQuestions = z.array(ZSurveyQuestion);
z.enum([
  "address",
  "cta",
  "consent",
  "date",
  "fileUpload",
  "matrix",
  "multipleChoiceMulti",
  "multipleChoiceSingle",
  "nps",
  "openText",
  "pictureSelection",
  "rating",
  "cal",
  "ranking",
  "contactInfo"
  /* ContactInfo */
]);
const ZSurveyLanguage = z.object({
  language: ZLanguage,
  default: z.boolean(),
  enabled: z.boolean()
});
z.object({
  questions: ZSurveyQuestions,
  hiddenFields: ZSurveyHiddenFields
});
const ZSurveyDisplayOption = z.enum([
  "displayOnce",
  "displayMultiple",
  "respondMultiple",
  "displaySome"
]);
const ZSurveyType = z.enum(["link", "app"]);
const ZSurveyStatus = z.enum(["draft", "scheduled", "inProgress", "paused", "completed"]);
z.object({
  codeConfig: z.object({ identifier: z.string() }).optional(),
  noCodeConfig: ZActionClassNoCodeConfig.optional()
});
const ZSurvey = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  type: ZSurveyType,
  environmentId: z.string(),
  createdBy: z.string().nullable(),
  status: ZSurveyStatus,
  displayOption: ZSurveyDisplayOption,
  autoClose: z.number().nullable(),
  triggers: z.array(z.object({ actionClass: ZActionClass })),
  recontactDays: z.number().nullable(),
  displayLimit: z.number().nullable(),
  welcomeCard: ZSurveyWelcomeCard,
  questions: ZSurveyQuestions.min(1, {
    message: "Survey must have at least one question"
  }).superRefine((questions, ctx) => {
    const questionIds = questions.map((q2) => q2.id);
    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Question IDs must be unique",
        path: [questionIds.findIndex((id, index) => questionIds.indexOf(id) !== index), "id"]
      });
    }
  }),
  endings: ZSurveyEndings.superRefine((endings, ctx) => {
    const endingIds = endings.map((q2) => q2.id);
    const uniqueEndingIds = new Set(endingIds);
    if (uniqueEndingIds.size !== endingIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ending IDs must be unique",
        path: [endingIds.findIndex((id, index) => endingIds.indexOf(id) !== index), "id"]
      });
    }
  }),
  hiddenFields: ZSurveyHiddenFields,
  variables: ZSurveyVariables.superRefine((variables, ctx) => {
    const variableIds = variables.map((v2) => v2.id);
    const uniqueVariableIds = new Set(variableIds);
    if (uniqueVariableIds.size !== variableIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variable IDs must be unique",
        path: ["variables"]
      });
    }
    const variableNames = variables.map((v2) => v2.name);
    const uniqueVariableNames = new Set(variableNames);
    if (uniqueVariableNames.size !== variableNames.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Variable names must be unique",
        path: ["variables"]
      });
    }
  }),
  delay: z.number(),
  autoComplete: z.number().min(1, { message: "Response limit must be greater than 0" }).nullable(),
  runOnDate: z.date().nullable(),
  closeOnDate: z.date().nullable(),
  productOverwrites: ZSurveyProductOverwrites.nullable(),
  styling: ZSurveyStyling.nullable(),
  showLanguageSwitch: z.boolean().nullable(),
  surveyClosedMessage: ZSurveyClosedMessage.nullable(),
  segment: ZSegment.nullable(),
  singleUse: ZSurveySingleUse.nullable(),
  isVerifyEmailEnabled: z.boolean(),
  isSingleResponsePerEmailEnabled: z.boolean(),
  pin: z.string().min(4, { message: "PIN must be a four digit number" }).nullish(),
  resultShareKey: z.string().nullable(),
  displayPercentage: z.number().min(0.01).max(100).nullable(),
  languages: z.array(ZSurveyLanguage)
}).superRefine((survey, ctx) => {
  const { questions, languages, welcomeCard, endings } = survey;
  let multiLangIssue;
  if (welcomeCard.enabled) {
    if (welcomeCard.headline) {
      multiLangIssue = validateCardFieldsForAllLanguages(
        "cardHeadline",
        welcomeCard.headline,
        languages,
        "welcome"
      );
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
    if (welcomeCard.html && welcomeCard.html.default.trim() !== "") {
      multiLangIssue = validateCardFieldsForAllLanguages(
        "welcomeCardHtml",
        welcomeCard.html,
        languages,
        "welcome"
      );
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
    if (welcomeCard.buttonLabel && welcomeCard.buttonLabel.default.trim() !== "") {
      multiLangIssue = validateCardFieldsForAllLanguages(
        "buttonLabel",
        welcomeCard.buttonLabel,
        languages,
        "welcome"
      );
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
  }
  questions.forEach((question, questionIndex) => {
    multiLangIssue = validateQuestionLabels("headline", question.headline, languages, questionIndex);
    if (multiLangIssue) {
      ctx.addIssue(multiLangIssue);
    }
    if (question.subheader && question.subheader.default.trim() !== "") {
      multiLangIssue = validateQuestionLabels("subheader", question.subheader, languages, questionIndex);
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
    const defaultLanguageCode = "default";
    const initialFieldsToValidate = [
      "html",
      "buttonLabel",
      "upperLabel",
      "lowerLabel",
      "label",
      "placeholder"
    ];
    const fieldsToValidate = questionIndex === 0 ? initialFieldsToValidate : [...initialFieldsToValidate, "backButtonLabel"];
    for (const field of fieldsToValidate) {
      if (field === "label" && question.type === "consent") {
        continue;
      }
      const questionFieldValue = question[field];
      if (typeof (questionFieldValue == null ? void 0 : questionFieldValue[defaultLanguageCode]) !== "undefined" && questionFieldValue[defaultLanguageCode].trim() !== "") {
        multiLangIssue = validateQuestionLabels(field, questionFieldValue, languages, questionIndex);
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }
    }
    if (question.type === "openText") {
      if (question.placeholder && question.placeholder[defaultLanguageCode].trim() !== "" && languages.length > 1) {
        multiLangIssue = validateQuestionLabels(
          "placeholder",
          question.placeholder,
          languages,
          questionIndex
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }
    }
    if (question.type === "multipleChoiceSingle" || question.type === "multipleChoiceMulti" || question.type === "ranking") {
      question.choices.forEach((choice, choiceIndex) => {
        multiLangIssue = validateQuestionLabels(
          `Choice ${String(choiceIndex + 1)}`,
          choice.label,
          languages,
          questionIndex,
          true
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      });
      const duplicateChoicesLanguageCodes = findLanguageCodesForDuplicateLabels(
        question.choices.map((choice) => choice.label),
        languages
      );
      if (duplicateChoicesLanguageCodes.length > 0) {
        const invalidLanguageCodes = duplicateChoicesLanguageCodes.map(
          (invalidLanguageCode) => {
            var _a2;
            return invalidLanguageCode === "default" ? ((_a2 = languages.find((lang) => lang.default)) == null ? void 0 : _a2.language.code) ?? "default" : invalidLanguageCode;
          }
        );
        const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${String(questionIndex + 1)} has duplicate choice labels ${isDefaultOnly ? "" : "for the following languages:"}`,
          path: ["questions", questionIndex, "choices"],
          params: isDefaultOnly ? void 0 : { invalidLanguageCodes }
        });
      }
    }
    if (question.type === "consent") {
      multiLangIssue = validateQuestionLabels("consent.label", question.label, languages, questionIndex);
      if (multiLangIssue) {
        ctx.addIssue(multiLangIssue);
      }
    }
    if (question.type === "cta") {
      if (!question.required && question.dismissButtonLabel) {
        multiLangIssue = validateQuestionLabels(
          "dismissButtonLabel",
          question.dismissButtonLabel,
          languages,
          questionIndex
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      }
      if (question.buttonExternal) {
        const parsedButtonUrl = z.string().url().safeParse(question.buttonUrl);
        if (!parsedButtonUrl.success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} has an invalid button URL`,
            path: ["questions", questionIndex, "buttonUrl"]
          });
        }
      }
    }
    if (question.type === "matrix") {
      question.rows.forEach((row, rowIndex) => {
        multiLangIssue = validateQuestionLabels(
          `Row ${String(rowIndex + 1)}`,
          row,
          languages,
          questionIndex,
          true
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      });
      question.columns.forEach((column, columnIndex) => {
        multiLangIssue = validateQuestionLabels(
          `Column ${String(columnIndex + 1)}`,
          column,
          languages,
          questionIndex,
          true
        );
        if (multiLangIssue) {
          ctx.addIssue(multiLangIssue);
        }
      });
      const duplicateRowsLanguageCodes = findLanguageCodesForDuplicateLabels(question.rows, languages);
      const duplicateColumnLanguageCodes = findLanguageCodesForDuplicateLabels(question.columns, languages);
      if (duplicateRowsLanguageCodes.length > 0) {
        const invalidLanguageCodes = duplicateRowsLanguageCodes.map(
          (invalidLanguageCode) => {
            var _a2;
            return invalidLanguageCode === "default" ? ((_a2 = languages.find((lang) => lang.default)) == null ? void 0 : _a2.language.code) ?? "default" : invalidLanguageCode;
          }
        );
        const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${String(questionIndex + 1)} has duplicate row labels ${isDefaultOnly ? "" : "for the following languages:"}`,
          path: ["questions", questionIndex, "rows"],
          params: isDefaultOnly ? void 0 : { invalidLanguageCodes }
        });
      }
      if (duplicateColumnLanguageCodes.length > 0) {
        const invalidLanguageCodes = duplicateColumnLanguageCodes.map(
          (invalidLanguageCode) => {
            var _a2;
            return invalidLanguageCode === "default" ? ((_a2 = languages.find((lang) => lang.default)) == null ? void 0 : _a2.language.code) ?? "default" : invalidLanguageCode;
          }
        );
        const isDefaultOnly = invalidLanguageCodes.length === 1 && invalidLanguageCodes[0] === "default";
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${String(questionIndex + 1)} has duplicate column labels ${isDefaultOnly ? "" : "for the following languages:"}`,
          path: ["questions", questionIndex, "columns"],
          params: isDefaultOnly ? void 0 : { invalidLanguageCodes }
        });
      }
    }
    if (question.type === "fileUpload") {
      if (question.allowedFileExtensions && question.allowedFileExtensions.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Question ${String(questionIndex + 1)} must have atleast one allowed file extension`,
          path: ["questions", questionIndex, "allowedFileExtensions"]
        });
      }
    }
    if (question.type === "cal") {
      if (question.calHost !== void 0) {
        const hostnameRegex = /^[a-zA-Z0-9]+(?<domain>\.[a-zA-Z0-9]+)+$/;
        if (!hostnameRegex.test(question.calHost)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question ${String(questionIndex + 1)} must have a valid host name`,
            path: ["questions", questionIndex, "calHost"]
          });
        }
      }
    }
    if (question.type === "contactInfo") {
      const { company, email, firstName, lastName, phone } = question;
      const fields = [company, email, firstName, lastName, phone];
      if (fields.every((field) => !field.show)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be shown in the Contact Info question",
          path: ["questions", questionIndex]
        });
      }
    }
    if (question.type === "address") {
      const { addressLine1, addressLine2, city, state, zip, country } = question;
      const fields = [addressLine1, addressLine2, city, state, zip, country];
      if (fields.every((field) => !field.show)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one field must be shown in the Address question",
          path: ["questions", questionIndex]
        });
      }
    }
    if (question.logic) {
      const logicIssues = validateLogic(survey, questionIndex, question.logic);
      logicIssues.forEach((issue) => {
        ctx.addIssue(issue);
      });
    }
  });
  const questionsWithCyclicLogic = findQuestionsWithCyclicLogic(questions);
  if (questionsWithCyclicLogic.length > 0) {
    questionsWithCyclicLogic.forEach((questionId) => {
      const questionIndex = questions.findIndex((q2) => q2.id === questionId);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Conditional Logic: Cyclic logic detected 🔃 Please check the logic of question ${String(questionIndex + 1)}.`,
        path: ["questions", questionIndex, "logic"]
      });
    });
  }
  endings.forEach((ending, index) => {
    if (ending.type === "endScreen") {
      const multiLangIssueInHeadline = validateCardFieldsForAllLanguages(
        "cardHeadline",
        ending.headline ?? {},
        languages,
        "end",
        index
      );
      if (multiLangIssueInHeadline) {
        ctx.addIssue(multiLangIssueInHeadline);
      }
      if (ending.subheader) {
        const multiLangIssueInSubheader = validateCardFieldsForAllLanguages(
          "subheader",
          ending.subheader,
          languages,
          "end",
          index
        );
        if (multiLangIssueInSubheader) {
          ctx.addIssue(multiLangIssueInSubheader);
        }
      }
      if (ending.buttonLabel) {
        const multiLangIssueInButtonLabel = validateCardFieldsForAllLanguages(
          "endingCardButtonLabel",
          ending.buttonLabel,
          languages,
          "end",
          index
        );
        if (multiLangIssueInButtonLabel) {
          ctx.addIssue(multiLangIssueInButtonLabel);
        }
      }
    }
    if (ending.type === "redirectToUrl") {
      if (!ending.label || ending.label.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Redirect Url label cannot be empty for ending Card ${String(index + 1)}.`,
          path: ["endings", index, "label"]
        });
      }
    }
  });
});
const isInvalidOperatorsForQuestionType = (question, operator) => {
  let isInvalidOperator = false;
  const questionType = question.type;
  if (question.required && operator === "isSkipped") return true;
  switch (questionType) {
    case "openText":
      switch (question.inputType) {
        case "email":
        case "phone":
        case "text":
        case "url":
          if (![
            "equals",
            "doesNotEqual",
            "contains",
            "doesNotContain",
            "startsWith",
            "doesNotStartWith",
            "endsWith",
            "doesNotEndWith",
            "isSubmitted",
            "isSkipped"
          ].includes(operator)) {
            isInvalidOperator = true;
          }
          break;
        case "number":
          if (![
            "equals",
            "doesNotEqual",
            "isGreaterThan",
            "isLessThan",
            "isGreaterThanOrEqual",
            "isLessThanOrEqual",
            "isSubmitted",
            "isSkipped"
          ].includes(operator)) {
            isInvalidOperator = true;
          }
      }
      break;
    case "multipleChoiceSingle":
      if (!["equals", "doesNotEqual", "equalsOneOf", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "multipleChoiceMulti":
    case "pictureSelection":
      if (!["equals", "doesNotEqual", "includesAllOf", "includesOneOf", "isSubmitted", "isSkipped"].includes(
        operator
      )) {
        isInvalidOperator = true;
      }
      break;
    case "nps":
    case "rating":
      if (![
        "equals",
        "doesNotEqual",
        "isGreaterThan",
        "isLessThan",
        "isGreaterThanOrEqual",
        "isLessThanOrEqual",
        "isSubmitted",
        "isSkipped"
      ].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "cta":
      if (!["isClicked", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "consent":
      if (!["isAccepted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "date":
      if (!["equals", "doesNotEqual", "isBefore", "isAfter", "isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "fileUpload":
    case "address":
    case "ranking":
      if (!["isSubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "cal":
      if (!["isBooked", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "matrix":
      if (!["isPartiallySubmitted", "isCompletelySubmitted", "isSkipped"].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    default:
      isInvalidOperator = true;
  }
  return isInvalidOperator;
};
const isInvalidOperatorsForVariableType = (variableType, operator) => {
  let isInvalidOperator = false;
  switch (variableType) {
    case "text":
      if (![
        "equals",
        "doesNotEqual",
        "contains",
        "doesNotContain",
        "startsWith",
        "doesNotStartWith",
        "endsWith",
        "doesNotEndWith"
      ].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
    case "number":
      if (![
        "equals",
        "doesNotEqual",
        "isGreaterThan",
        "isLessThan",
        "isGreaterThanOrEqual",
        "isLessThanOrEqual"
      ].includes(operator)) {
        isInvalidOperator = true;
      }
      break;
  }
  return isInvalidOperator;
};
const isInvalidOperatorsForHiddenFieldType = (operator) => {
  let isInvalidOperator = false;
  if (![
    "equals",
    "doesNotEqual",
    "contains",
    "doesNotContain",
    "startsWith",
    "doesNotStartWith",
    "endsWith",
    "doesNotEndWith"
  ].includes(operator)) {
    isInvalidOperator = true;
  }
  return isInvalidOperator;
};
const validateConditions = (survey, questionIndex, logicIndex, conditions) => {
  const issues = [];
  const validateSingleCondition = (condition) => {
    var _a2, _b, _c, _d, _e;
    const { leftOperand, operator, rightOperand } = condition;
    if (leftOperand.type === "question") {
      const questionId = leftOperand.value;
      const questionIdx = survey.questions.findIndex((q2) => q2.id === questionId);
      const question = questionIdx !== -1 ? survey.questions[questionIdx] : void 0;
      if (!question) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
        return;
      } else if (questionIndex < questionIdx) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Question ${String(questionIndex + 1)} cannot refer to a question ${String(questionIdx + 1)} that appears later in the survey`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
        return;
      }
      const isInvalidOperator = isInvalidOperatorsForQuestionType(question, operator);
      if (isInvalidOperator) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Invalid operator "${operator}" for question type "${question.type}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
      }
      if ([
        "isSubmitted",
        "isSkipped",
        "isClicked",
        "isAccepted",
        "isBooked",
        "isPartiallySubmitted",
        "isCompletelySubmitted"
      ].includes(operator)) {
        if (rightOperand !== void 0) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should not be defined for operator "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        }
        return;
      }
      if (question.type === "openText") {
        if ((rightOperand == null ? void 0 : rightOperand.type) === "question") {
          const quesId = rightOperand.value;
          const ques = survey.questions.find((q2) => q2.id === quesId);
          if (!ques) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            const validQuestionTypes = [
              "openText"
              /* OpenText */
            ];
            if (question.inputType === "number") {
              validQuestionTypes.push(...[
                "rating",
                "nps"
                /* NPS */
              ]);
            }
            if (["equals", "doesNotEqual"].includes(condition.operator)) {
              if (question.inputType !== "number") {
                validQuestionTypes.push(
                  ...[
                    "date",
                    "multipleChoiceSingle",
                    "multipleChoiceMulti"
                    /* MultipleChoiceMulti */
                  ]
                );
              }
            }
            if (!validQuestionTypes.includes(ques.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${ques.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v2) => v2.id === variableId);
          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = (_a2 = survey.hiddenFields.fieldIds) == null ? void 0 : _a2.find((id) => id === fieldId);
          if (!field) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "static") {
          if (!rightOperand.value) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Static value is required in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        }
      } else if (question.type === "multipleChoiceSingle") {
        if ((rightOperand == null ? void 0 : rightOperand.type) !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            const choice = question.choices.find((c2) => c2.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice with label "${rightOperand.value}" does not exist in question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        } else if (condition.operator === "equalsOneOf") {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: z.ZodIssueCode.custom,
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
                });
              }
            });
            const choices = question.choices.map((c2) => c2.id);
            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choices selected in right operand does not exist in the choices of the question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        }
      } else if (question.type === "multipleChoiceMulti" || question.type === "pictureSelection") {
        if ((rightOperand == null ? void 0 : rightOperand.type) !== "static") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be amongst the choice values for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        } else if (condition.operator === "equals" || condition.operator === "doesNotEqual") {
          if (typeof rightOperand.value !== "string") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a string for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            const choice = question.choices.find((c2) => c2.id === rightOperand.value);
            if (!choice) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choice with label "${rightOperand.value}" does not exist in question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        } else if (condition.operator === "includesAllOf" || condition.operator === "includesOneOf") {
          if (!Array.isArray(rightOperand.value)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be an array for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            rightOperand.value.forEach((value) => {
              if (typeof value !== "string") {
                issues.push({
                  code: z.ZodIssueCode.custom,
                  message: `Conditional Logic: Right operand should be an array of strings for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                  path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
                });
              }
            });
            const choices = question.choices.map((c2) => c2.id);
            if (rightOperand.value.some((value) => !choices.includes(value))) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Choices selected in right operand does not exist in the choices of the question in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        }
      } else if (question.type === "nps" || question.type === "rating") {
        if ((rightOperand == null ? void 0 : rightOperand.type) === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v2) => v2.id === variableId);
          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (variable.type !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be number in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "static") {
          if (typeof rightOperand.value !== "number") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Right operand should be a number for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (question.type === "nps") {
            if (rightOperand.value < 0 || rightOperand.value > 10) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: NPS score should be between 0 and 10 for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          } else if (rightOperand.value < 1 || rightOperand.value > question.range) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Rating value should be between 1 and ${String(question.range)} for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Right operand should be a variable or a static value for "${operator}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        }
      } else if (question.type === "date") {
        if ((rightOperand == null ? void 0 : rightOperand.type) === "question") {
          const quesId = rightOperand.value;
          const ques = survey.questions.find((q2) => q2.id === quesId);
          if (!ques) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else {
            const validQuestionTypes = [
              "openText",
              "date"
              /* Date */
            ];
            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "variable") {
          const variableId = rightOperand.value;
          const variable = survey.variables.find((v2) => v2.id === variableId);
          if (!variable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (variable.type !== "text") {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "hiddenField") {
          const fieldId = rightOperand.value;
          const doesFieldExists = (_b = survey.hiddenFields.fieldIds) == null ? void 0 : _b.includes(fieldId);
          if (!doesFieldExists) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "static") {
          const date = rightOperand.value;
          if (!date) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Please select a date value in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (isNaN(new Date(date).getTime())) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid date format for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        }
      }
    } else if (leftOperand.type === "variable") {
      const variableId = leftOperand.value;
      const variable = survey.variables.find((v2) => v2.id === variableId);
      if (!variable) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
      } else {
        const isInvalidOperator = isInvalidOperatorsForVariableType(variable.type, operator);
        if (isInvalidOperator) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid operator "${operator}" for variable ${variable.name} of type "${variable.type}" in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        }
        if ((rightOperand == null ? void 0 : rightOperand.type) === "question") {
          const questionId = rightOperand.value;
          const question = survey.questions.find((q2) => q2.id === questionId);
          if (!question) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (variable.type === "number") {
            const validQuestionTypes = [
              "rating",
              "nps"
              /* NPS */
            ];
            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          } else {
            const validQuestionTypes = [
              "openText",
              "multipleChoiceSingle"
              /* MultipleChoiceSingle */
            ];
            if (["equals", "doesNotEqual"].includes(operator)) {
              validQuestionTypes.push(
                "multipleChoiceMulti",
                "date"
                /* Date */
              );
            }
            if (!validQuestionTypes.includes(question.type)) {
              issues.push({
                code: z.ZodIssueCode.custom,
                message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
                path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
              });
            }
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "variable") {
          const id = rightOperand.value;
          const foundVariable = survey.variables.find((v2) => v2.id === id);
          if (!foundVariable) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          } else if (variable.type !== foundVariable.type) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Variable type mismatch in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        } else if ((rightOperand == null ? void 0 : rightOperand.type) === "hiddenField") {
          const fieldId = rightOperand.value;
          const field = (_c = survey.hiddenFields.fieldIds) == null ? void 0 : _c.find((id) => id === fieldId);
          if (!field) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        }
      }
    } else {
      const hiddenFieldId = leftOperand.value;
      const hiddenField = (_d = survey.hiddenFields.fieldIds) == null ? void 0 : _d.find((fieldId) => fieldId === hiddenFieldId);
      if (!hiddenField) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Hidden field ID ${hiddenFieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
      }
      const isInvalidOperator = isInvalidOperatorsForHiddenFieldType(operator);
      if (isInvalidOperator) {
        issues.push({
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Invalid operator "${operator}" for hidden field in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
        });
      }
      if ((rightOperand == null ? void 0 : rightOperand.type) === "question") {
        const questionId = rightOperand.value;
        const question = survey.questions.find((q2) => q2.id === questionId);
        if (!question) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Question ID ${questionId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        } else {
          const validQuestionTypes = [
            "openText",
            "multipleChoiceSingle"
            /* MultipleChoiceSingle */
          ];
          if (["equals", "doesNotEqual"].includes(condition.operator)) {
            validQuestionTypes.push(
              "multipleChoiceMulti",
              "date"
              /* Date */
            );
          }
          if (!validQuestionTypes.includes(question.type)) {
            issues.push({
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid question type "${question.type}" for right operand in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
            });
          }
        }
      } else if ((rightOperand == null ? void 0 : rightOperand.type) === "variable") {
        const variableId = rightOperand.value;
        const variable = survey.variables.find((v2) => v2.id === variableId);
        if (!variable) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Variable ID ${variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        } else if (variable.type !== "text") {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Variable type should be text in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        }
      } else if ((rightOperand == null ? void 0 : rightOperand.type) === "hiddenField") {
        const fieldId = rightOperand.value;
        const field = (_e = survey.hiddenFields.fieldIds) == null ? void 0 : _e.find((id) => id === fieldId);
        if (!field) {
          issues.push({
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Hidden field ID ${fieldId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex, "conditions"]
          });
        }
      }
    }
  };
  const validateConditionGroup = (group) => {
    group.conditions.forEach((condition) => {
      if (isConditionGroup$1(condition)) {
        validateConditionGroup(condition);
      } else {
        validateSingleCondition(condition);
      }
    });
  };
  validateConditionGroup(conditions);
  return issues;
};
const validateActions = (survey, questionIndex, logicIndex, actions) => {
  const questionIds = survey.questions.map((q2) => q2.id);
  const actionIssues = actions.map((action) => {
    if (action.objective === "calculate") {
      const variable = survey.variables.find((v2) => v2.id === action.variableId);
      if (!variable) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Conditional Logic: Variable ID ${action.variableId} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic", logicIndex]
        };
      }
      if (action.value.type === "variable") {
        const selectedVariable = survey.variables.find((v2) => v2.id === action.value.value);
        if (!selectedVariable || selectedVariable.type !== variable.type) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid variable type for variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex]
          };
        }
      }
      if (variable.type === "text") {
        const textVariableParseData = ZActionCalculateText.safeParse(action);
        if (!textVariableParseData.success) {
          return {
            code: z.ZodIssueCode.custom,
            message: textVariableParseData.error.errors[0].message,
            path: ["questions", questionIndex, "logic", logicIndex]
          };
        }
        if (action.value.type === "question") {
          const allowedQuestions = [
            "openText",
            "multipleChoiceSingle",
            "rating",
            "nps",
            "date"
            /* Date */
          ];
          const selectedQuestion = survey.questions.find((q2) => q2.id === action.value.value);
          if (!selectedQuestion || !allowedQuestions.includes(selectedQuestion.type)) {
            return {
              code: z.ZodIssueCode.custom,
              message: `Conditional Logic: Invalid question type for text variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
              path: ["questions", questionIndex, "logic", logicIndex]
            };
          }
        }
        return void 0;
      }
      const numberVariableParseData = ZActionCalculateNumber.safeParse(action);
      if (!numberVariableParseData.success) {
        return {
          code: z.ZodIssueCode.custom,
          message: numberVariableParseData.error.errors[0].message,
          path: ["questions", questionIndex, "logic", logicIndex]
        };
      }
      if (action.value.type === "question") {
        const allowedQuestions = [
          "rating",
          "nps"
          /* NPS */
        ];
        const selectedQuestion = survey.questions.find((q2) => q2.id === action.value.value);
        if (!selectedQuestion || !allowedQuestions.includes(selectedQuestion.type)) {
          return {
            code: z.ZodIssueCode.custom,
            message: `Conditional Logic: Invalid question type for number variable in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex]
          };
        }
      }
    } else {
      const endingIds = survey.endings.map((ending) => ending.id);
      const possibleQuestionIds = action.objective === "jumpToQuestion" ? [...questionIds, ...endingIds] : questionIds;
      if (!possibleQuestionIds.includes(action.target)) {
        return {
          code: z.ZodIssueCode.custom,
          message: `Question ID ${action.target} does not exist in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
          path: ["questions", questionIndex, "logic"]
        };
      }
      if (action.objective === "requireAnswer") {
        const optionalQuestionIds = survey.questions.filter((question) => !question.required).map((question) => question.id);
        if (!optionalQuestionIds.includes(action.target)) {
          const quesIdx = survey.questions.findIndex((q2) => q2.id === action.target);
          return {
            code: z.ZodIssueCode.custom,
            message: `Question ${String(quesIdx + 1)} is already required in logic no: ${String(logicIndex + 1)} of question ${String(questionIndex + 1)}`,
            path: ["questions", questionIndex, "logic", logicIndex]
          };
        }
      }
    }
    return void 0;
  });
  const filteredActionIssues = actionIssues.filter((issue) => issue !== void 0);
  return filteredActionIssues;
};
const validateLogic = (survey, questionIndex, logic) => {
  const logicIssues = logic.map((logicItem, logicIndex) => {
    return [
      ...validateConditions(survey, questionIndex, logicIndex, logicItem.conditions),
      ...validateActions(survey, questionIndex, logicIndex, logicItem.actions)
    ];
  });
  return logicIssues.flat();
};
ZSurvey.innerType().omit({ createdAt: true, updatedAt: true }).and(
  z.object({
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date()
  })
).superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => void 0);
const makeSchemaOptional = (schema) => {
  return schema.extend(
    Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, value.optional()]))
  );
};
makeSchemaOptional(ZSurvey.innerType()).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  productOverwrites: true,
  languages: true
}).extend({
  name: z.string(),
  // Keep name required
  questions: ZSurvey.innerType().shape.questions,
  // Keep questions required and with its original validation
  languages: z.array(ZSurveyLanguage).default([]),
  welcomeCard: ZSurveyWelcomeCard.default({
    enabled: false
  }),
  endings: ZSurveyEndings.default([]),
  type: ZSurveyType.default("link")
}).superRefine(ZSurvey._def.effect.type === "refinement" ? ZSurvey._def.effect.refinement : () => null);
const ZSurveyQuestionSummaryOpenText = z.object({
  type: z.literal("openText"),
  question: ZSurveyOpenTextQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryMultipleChoice = z.object({
  type: z.union([z.literal("multipleChoiceMulti"), z.literal("multipleChoiceSingle")]),
  question: ZSurveyMultipleChoiceQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      percentage: z.number(),
      others: z.array(
        z.object({
          value: z.string(),
          person: z.object({
            id: ZId,
            userId: z.string()
          }).nullable(),
          personAttributes: ZAttributes.nullable()
        })
      ).optional()
    })
  )
});
const ZSurveyQuestionSummaryPictureSelection = z.object({
  type: z.literal("pictureSelection"),
  question: ZSurveyPictureSelectionQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      count: z.number(),
      percentage: z.number()
    })
  )
});
const ZSurveyQuestionSummaryRating = z.object({
  type: z.literal("rating"),
  question: ZSurveyRatingQuestion,
  responseCount: z.number(),
  average: z.number(),
  choices: z.array(
    z.object({
      rating: z.number(),
      count: z.number(),
      percentage: z.number()
    })
  ),
  dismissed: z.object({
    count: z.number()
  })
});
const ZSurveyQuestionSummaryNps = z.object({
  type: z.literal("nps"),
  question: ZSurveyNPSQuestion,
  responseCount: z.number(),
  total: z.number(),
  score: z.number(),
  promoters: z.object({
    count: z.number(),
    percentage: z.number()
  }),
  passives: z.object({
    count: z.number(),
    percentage: z.number()
  }),
  detractors: z.object({
    count: z.number(),
    percentage: z.number()
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number()
  })
});
const ZSurveyQuestionSummaryCta = z.object({
  type: z.literal("cta"),
  question: ZSurveyCTAQuestion,
  impressionCount: z.number(),
  clickCount: z.number(),
  skipCount: z.number(),
  responseCount: z.number(),
  ctr: z.object({
    count: z.number(),
    percentage: z.number()
  })
});
const ZSurveyQuestionSummaryConsent = z.object({
  type: z.literal("consent"),
  question: ZSurveyConsentQuestion,
  responseCount: z.number(),
  accepted: z.object({
    count: z.number(),
    percentage: z.number()
  }),
  dismissed: z.object({
    count: z.number(),
    percentage: z.number()
  })
});
const ZSurveyQuestionSummaryDate = z.object({
  type: z.literal("date"),
  question: ZSurveyDateQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.string(),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryFileUpload = z.object({
  type: z.literal("fileUpload"),
  question: ZSurveyFileUploadQuestion,
  responseCount: z.number(),
  files: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryCal = z.object({
  type: z.literal("cal"),
  question: ZSurveyCalQuestion,
  responseCount: z.number(),
  booked: z.object({
    count: z.number(),
    percentage: z.number()
  }),
  skipped: z.object({
    count: z.number(),
    percentage: z.number()
  })
});
const ZSurveyQuestionSummaryMatrix = z.object({
  type: z.literal("matrix"),
  question: ZSurveyMatrixQuestion,
  responseCount: z.number(),
  data: z.array(
    z.object({
      rowLabel: z.string(),
      columnPercentages: z.record(z.string(), z.number()),
      totalResponsesForRow: z.number()
    })
  )
});
const ZSurveyQuestionSummaryHiddenFields = z.object({
  type: z.literal("hiddenField"),
  id: z.string(),
  responseCount: z.number(),
  samples: z.array(
    z.object({
      updatedAt: z.date(),
      value: z.string(),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryAddress = z.object({
  type: z.literal("address"),
  question: ZSurveyAddressQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryContactInfo = z.object({
  type: z.literal("contactInfo"),
  question: ZSurveyContactInfoQuestion,
  responseCount: z.number(),
  samples: z.array(
    z.object({
      id: z.string(),
      updatedAt: z.date(),
      value: z.array(z.string()),
      person: z.object({
        id: ZId,
        userId: z.string()
      }).nullable(),
      personAttributes: ZAttributes.nullable()
    })
  )
});
const ZSurveyQuestionSummaryRanking = z.object({
  type: z.literal("ranking"),
  question: ZSurveyRankingQuestion,
  responseCount: z.number(),
  choices: z.array(
    z.object({
      value: z.string(),
      count: z.number(),
      avgRanking: z.number(),
      others: z.array(
        z.object({
          value: z.string(),
          person: z.object({
            id: ZId,
            userId: z.string()
          }).nullable(),
          personAttributes: ZAttributes.nullable()
        })
      ).optional()
    })
  )
});
const ZSurveyQuestionSummary = z.union([
  ZSurveyQuestionSummaryOpenText,
  ZSurveyQuestionSummaryMultipleChoice,
  ZSurveyQuestionSummaryPictureSelection,
  ZSurveyQuestionSummaryRating,
  ZSurveyQuestionSummaryNps,
  ZSurveyQuestionSummaryCta,
  ZSurveyQuestionSummaryConsent,
  ZSurveyQuestionSummaryDate,
  ZSurveyQuestionSummaryFileUpload,
  ZSurveyQuestionSummaryCal,
  ZSurveyQuestionSummaryMatrix,
  ZSurveyQuestionSummaryAddress,
  ZSurveyQuestionSummaryRanking,
  ZSurveyQuestionSummaryContactInfo
]);
z.object({
  meta: z.object({
    displayCount: z.number(),
    totalResponses: z.number(),
    startsPercentage: z.number(),
    completedResponses: z.number(),
    completedPercentage: z.number(),
    dropOffCount: z.number(),
    dropOffPercentage: z.number(),
    ttcAverage: z.number()
  }),
  dropOff: z.array(
    z.object({
      questionId: z.string().cuid2(),
      headline: z.string(),
      ttc: z.number(),
      impressions: z.number(),
      dropOffCount: z.number(),
      dropOffPercentage: z.number()
    })
  ),
  summary: z.array(z.union([ZSurveyQuestionSummary, ZSurveyQuestionSummaryHiddenFields]))
});
z.object({
  name: z.string().optional(),
  status: z.array(ZSurveyStatus).optional(),
  type: z.array(ZSurveyType).optional(),
  createdBy: z.object({
    userId: z.string(),
    value: z.array(z.enum(["you", "others"]))
  }).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "relevance"]).optional()
});
z.object({
  name: z.string(),
  createdBy: z.array(z.enum(["you", "others"])),
  status: z.array(ZSurveyStatus),
  type: z.array(ZSurveyType),
  sortBy: z.enum(["createdAt", "updatedAt", "name", "relevance"])
});
z.object({
  label: z.string(),
  value: z.string()
});
z.object({
  label: z.string(),
  value: z.enum(["createdAt", "updatedAt", "name", "relevance"])
});
z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(["question", "hiddenField", "attributeClass", "variable"])
});
z.object({
  products: z.array(
    z.object({
      product: z.string(),
      environments: z.array(z.string())
    })
  )
});
const QuestionConditional = ({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  prefilledQuestionValue,
  skipPrefilled,
  ttc,
  setTtc,
  surveyId,
  onFileUpload,
  autoFocusEnabled,
  currentQuestionId
}) => {
  const getResponseValueForRankingQuestion = (value2, choices) => {
    return value2.map((label) => {
      var _a2;
      return (_a2 = choices.find((choice) => getLocalizedValue(choice.label, languageCode) === label)) == null ? void 0 : _a2.id;
    }).filter((id) => id !== void 0);
  };
  if (!value && (prefilledQuestionValue || prefilledQuestionValue === "")) {
    if (skipPrefilled) {
      onSubmit({ [question.id]: prefilledQuestionValue }, { [question.id]: 0 });
    } else {
      onChange({ [question.id]: prefilledQuestionValue });
    }
  }
  return question.type === TSurveyQuestionTypeEnum.OpenText ? /* @__PURE__ */ u$1(
    OpenTextQuestion,
    {
      question,
      value: typeof value === "string" ? value : "",
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceSingle ? /* @__PURE__ */ u$1(
    MultipleChoiceSingleQuestion,
    {
      question,
      value: typeof value === "string" ? value : void 0,
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti ? /* @__PURE__ */ u$1(
    MultipleChoiceMultiQuestion,
    {
      question,
      value: Array.isArray(value) ? value : [],
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.NPS ? /* @__PURE__ */ u$1(
    NPSQuestion,
    {
      question,
      value: typeof value === "number" ? value : void 0,
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.CTA ? /* @__PURE__ */ u$1(
    CTAQuestion,
    {
      question,
      value: typeof value === "string" ? value : "",
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.Rating ? /* @__PURE__ */ u$1(
    RatingQuestion,
    {
      question,
      value: typeof value === "number" ? value : void 0,
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.Consent ? /* @__PURE__ */ u$1(
    ConsentQuestion,
    {
      question,
      value: typeof value === "string" ? value : "",
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.Date ? /* @__PURE__ */ u$1(
    DateQuestion,
    {
      question,
      value: typeof value === "string" ? value : "",
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.PictureSelection ? /* @__PURE__ */ u$1(
    PictureSelectionQuestion,
    {
      question,
      value: Array.isArray(value) ? value : [],
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.FileUpload ? /* @__PURE__ */ u$1(
    FileUploadQuestion,
    {
      surveyId,
      question,
      value: Array.isArray(value) ? value : [],
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      onFileUpload,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.Cal ? /* @__PURE__ */ u$1(
    CalQuestion,
    {
      question,
      value: typeof value === "string" ? value : "",
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      autoFocusEnabled,
      setTtc,
      currentQuestionId
    },
    question.id
  ) : question.type === TSurveyQuestionTypeEnum.Matrix ? /* @__PURE__ */ u$1(
    MatrixQuestion,
    {
      question,
      value: typeof value === "object" && !Array.isArray(value) ? value : {},
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      currentQuestionId
    }
  ) : question.type === TSurveyQuestionTypeEnum.Address ? /* @__PURE__ */ u$1(
    AddressQuestion,
    {
      question,
      value: Array.isArray(value) ? value : void 0,
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      currentQuestionId
    }
  ) : question.type === TSurveyQuestionTypeEnum.Ranking ? /* @__PURE__ */ u$1(
    RankingQuestion,
    {
      question,
      value: Array.isArray(value) ? getResponseValueForRankingQuestion(value, question.choices) : [],
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      autoFocusEnabled,
      currentQuestionId
    }
  ) : question.type === TSurveyQuestionTypeEnum.ContactInfo ? /* @__PURE__ */ u$1(
    ContactInfoQuestion,
    {
      question,
      value: Array.isArray(value) ? value : void 0,
      onChange,
      onSubmit,
      onBack,
      isFirstQuestion,
      isLastQuestion,
      languageCode,
      ttc,
      setTtc,
      currentQuestionId
    }
  ) : null;
};
const processResponseData = (responseData) => {
  switch (typeof responseData) {
    case "string":
      return responseData;
    case "number":
      return responseData.toString();
    case "object":
      if (Array.isArray(responseData)) {
        responseData = responseData.filter((item) => item !== null && item !== void 0 && item !== "").join(", ");
        return responseData;
      } else {
        const formattedString = Object.entries(responseData).filter(([_2, value]) => value !== "").map(([key, value]) => `${key}: ${value}`).join("\n");
        return formattedString;
      }
    default:
      return "";
  }
};
const ResponseErrorComponent = ({ questions, responseData, onRetry }) => {
  return /* @__PURE__ */ u$1("div", { className: "fb-flex fb-flex-col fb-bg-white fb-p-4s", children: [
    /* @__PURE__ */ u$1("span", { className: "fb-mb-1.5 fb-text-base fb-font-bold fb-leading-6 fb-text-slate-900", children: "Your feedback is stuck :(" }),
    /* @__PURE__ */ u$1("p", { className: "fb-max-w-md fb-text-sm fb-font-normal fb-leading-6 fb-text-slate-600", children: [
      "The servers cannot be reached at the moment.",
      /* @__PURE__ */ u$1("br", {}),
      "Please retry now or try again later."
    ] }),
    /* @__PURE__ */ u$1("div", { className: "fb-mt-4 fb-rounded-lg fb-border fb-border-slate-200 fb-bg-slate-100 fb-px-4 fb-py-5", children: /* @__PURE__ */ u$1("div", { className: "fb-flex fb-max-h-36 fb-flex-1 fb-flex-col fb-space-y-3 fb-overflow-y-scroll", children: questions.map((question, index) => {
      const response = responseData[question.id];
      if (!response) return;
      return /* @__PURE__ */ u$1("div", { className: "fb-flex fb-flex-col", children: [
        /* @__PURE__ */ u$1("span", { className: "fb-text-sm fb-leading-6 fb-text-slate-900", children: `Question ${index + 1}` }),
        /* @__PURE__ */ u$1("span", { className: "fb-mt-1 fb-text-sm fb-font-semibold fb-leading-6 fb-text-slate-900", children: processResponseData(response) })
      ] });
    }) }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-mt-4 fb-flex fb-flex-1 fb-flex-row fb-items-center fb-justify-end fb-space-x-2", children: /* @__PURE__ */ u$1(SubmitButton, { tabIndex: 2, buttonLabel: "Retry", isLastQuestion: false, onClick: () => onRetry() }) })
  ] });
};
const SurveyCloseButton = ({ onClose }) => {
  return /* @__PURE__ */ u$1("div", { class: "fb-z-[1001] fb-flex fb-w-fit fb-items-center even:fb-border-l even:fb-pl-1", children: /* @__PURE__ */ u$1(
    "button",
    {
      type: "button",
      onClick: onClose,
      class: "fb-text-heading fb-relative fb-h-5 fb-w-5 fb-rounded-md hover:fb-bg-black/5 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2",
      children: /* @__PURE__ */ u$1(
        "svg",
        {
          class: "fb-h-5 fb-w-5 fb-p-0.5",
          fill: "none",
          viewBox: "0 0 24 24",
          strokeWidth: "1",
          stroke: "currentColor",
          "aria-hidden": "true",
          children: /* @__PURE__ */ u$1("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M4 4L20 20M4 20L20 4" })
        }
      )
    }
  ) });
};
const TimerIcon = () => {
  return /* @__PURE__ */ u$1("div", { className: "fb-mr-1", children: /* @__PURE__ */ u$1(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      width: "16",
      height: "16",
      fill: "currentColor",
      class: "bi bi-stopwatch",
      viewBox: "0 0 16 16",
      children: [
        /* @__PURE__ */ u$1("path", { d: "M8.5 5.6a.5.5 0 1 0-1 0v2.9h-3a.5.5 0 0 0 0 1H8a.5.5 0 0 0 .5-.5V5.6z" }),
        /* @__PURE__ */ u$1("path", { d: "M6.5 1A.5.5 0 0 1 7 .5h2a.5.5 0 0 1 0 1v.57c1.36.196 2.594.78 3.584 1.64a.715.715 0 0 1 .012-.013l.354-.354-.354-.353a.5.5 0 0 1 .707-.708l1.414 1.415a.5.5 0 1 1-.707.707l-.353-.354-.354.354a.512.512 0 0 1-.013.012A7 7 0 1 1 7 2.071V1.5a.5.5 0 0 1-.5-.5zM8 3a6 6 0 1 0 .001 12A6 6 0 0 0 8 3z" })
      ]
    }
  ) });
};
const UsersIcon = () => {
  return /* @__PURE__ */ u$1("div", { className: "fb-mr-1", children: /* @__PURE__ */ u$1(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      strokeWidth: "1.5",
      stroke: "currentColor",
      class: "fb-h-4 fb-w-4",
      children: /* @__PURE__ */ u$1(
        "path",
        {
          strokeLinecap: "round",
          strokeLinejoin: "round",
          d: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        }
      )
    }
  ) });
};
const WelcomeCard = ({
  headline,
  html,
  fileUrl,
  buttonLabel,
  onSubmit,
  languageCode,
  survey,
  responseCount,
  autoFocusEnabled,
  isCurrent,
  responseData,
  variablesData
}) => {
  const calculateTimeToComplete = () => {
    let idx = calculateElementIdx(survey, 0);
    if (idx === 0.5) {
      idx = 1;
    }
    const timeInSeconds = survey.questions.length / idx * 15;
    if (timeInSeconds > 360) {
      return "6+ minutes";
    }
    const minutes = Math.floor(timeInSeconds / 60);
    const remainingSeconds = timeInSeconds % 60;
    if (remainingSeconds > 0) {
      if (minutes === 0) {
        return "less than 1 minute";
      } else {
        return `less than ${minutes + 1} minutes`;
      }
    }
    return `${minutes} minutes`;
  };
  const timeToFinish = survey.welcomeCard.timeToFinish;
  const showResponseCount = survey.welcomeCard.showResponseCount;
  const handleSubmit = () => {
    onSubmit({ ["welcomeCard"]: "clicked" }, {});
  };
  y(() => {
    const handleEnter = (e2) => {
      if (e2.key === "Enter") {
        handleSubmit();
      }
    };
    if (isCurrent && survey.type === "link") {
      document.addEventListener("keydown", handleEnter);
    } else {
      document.removeEventListener("keydown", handleEnter);
    }
    return () => {
      document.removeEventListener("keydown", handleEnter);
    };
  }, [isCurrent]);
  return /* @__PURE__ */ u$1("div", { children: [
    /* @__PURE__ */ u$1(ScrollableContainer, { children: /* @__PURE__ */ u$1("div", { children: [
      fileUrl && /* @__PURE__ */ u$1(
        "img",
        {
          src: fileUrl,
          className: "fb-mb-8 fb-max-h-96 fb-w-1/3 fb-rounded-lg fb-object-contain",
          alt: "Company Logo"
        }
      ),
      /* @__PURE__ */ u$1(
        Headline,
        {
          headline: replaceRecallInfo(
            getLocalizedValue(headline, languageCode),
            responseData,
            variablesData
          ),
          questionId: "welcomeCard"
        }
      ),
      /* @__PURE__ */ u$1(
        HtmlBody,
        {
          htmlString: replaceRecallInfo(getLocalizedValue(html, languageCode), responseData, variablesData),
          questionId: "welcomeCard"
        }
      )
    ] }) }),
    /* @__PURE__ */ u$1("div", { className: "fb-mx-6 fb-mt-4 fb-flex fb-gap-4 fb-py-4", children: /* @__PURE__ */ u$1(
      SubmitButton,
      {
        buttonLabel: getLocalizedValue(buttonLabel, languageCode),
        isLastQuestion: false,
        focus: autoFocusEnabled,
        onClick: handleSubmit,
        type: "button",
        onKeyDown: (e2) => e2.key === "Enter" && e2.preventDefault()
      }
    ) }),
    timeToFinish && !showResponseCount ? /* @__PURE__ */ u$1("div", { className: "fb-items-center fb-text-subheading fb-my-4 fb-ml-6 fb-flex", children: [
      /* @__PURE__ */ u$1(TimerIcon, {}),
      /* @__PURE__ */ u$1("p", { className: "fb-pt-1 fb-text-xs", children: /* @__PURE__ */ u$1("span", { children: [
        " Takes ",
        calculateTimeToComplete(),
        " "
      ] }) })
    ] }) : showResponseCount && !timeToFinish && responseCount && responseCount > 3 ? /* @__PURE__ */ u$1("div", { className: "fb-items-center fb-text-subheading fb-my-4 fb-ml-6 fb-flex", children: [
      /* @__PURE__ */ u$1(UsersIcon, {}),
      /* @__PURE__ */ u$1("p", { className: "fb-pt-1 fb-text-xs", children: /* @__PURE__ */ u$1("span", { children: `${responseCount} people responded` }) })
    ] }) : timeToFinish && showResponseCount ? /* @__PURE__ */ u$1("div", { className: "fb-items-center fb-text-subheading fb-my-4 fb-ml-6 fb-flex", children: [
      /* @__PURE__ */ u$1(TimerIcon, {}),
      /* @__PURE__ */ u$1("p", { className: "fb-pt-1 fb-text-xs", children: [
        /* @__PURE__ */ u$1("span", { children: [
          " Takes ",
          calculateTimeToComplete(),
          " "
        ] }),
        /* @__PURE__ */ u$1("span", { children: responseCount && responseCount > 3 ? `⋅ ${responseCount} people responded` : "" })
      ] })
    ] }) : null
  ] });
};
const AutoCloseProgressBar = ({ autoCloseTimeout }) => {
  return /* @__PURE__ */ u$1("div", { className: "fb-bg-accent-bg fb-h-2 fb-w-full fb-overflow-hidden fb-rounded-full", children: /* @__PURE__ */ u$1(
    "div",
    {
      className: "fb-bg-brand fb-z-20 fb-h-2 fb-rounded-full",
      style: {
        animation: `shrink-width-to-zero ${autoCloseTimeout}s linear forwards`
      }
    },
    autoCloseTimeout
  ) });
};
const AutoCloseWrapper = ({ survey, onClose, children, offset }) => {
  const [countDownActive, setCountDownActive] = h(true);
  const timeoutRef = A$1(null);
  const isAppSurvey = survey.type === "app";
  const showAutoCloseProgressBar = countDownActive && isAppSurvey && offset === 0;
  const startCountdown = () => {
    if (!survey.autoClose) return;
    if (timeoutRef.current) {
      stopCountdown();
    }
    setCountDownActive(true);
    timeoutRef.current = setTimeout(() => {
      onClose();
      setCountDownActive(false);
    }, survey.autoClose * 1e3);
  };
  const stopCountdown = () => {
    setCountDownActive(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };
  y(() => {
    startCountdown();
    return stopCountdown;
  }, [survey.autoClose]);
  return /* @__PURE__ */ u$1("div", { className: "fb-h-full fb-w-full", children: [
    survey.autoClose && showAutoCloseProgressBar && /* @__PURE__ */ u$1(AutoCloseProgressBar, { autoCloseTimeout: survey.autoClose }),
    /* @__PURE__ */ u$1("div", { onClick: stopCountdown, onMouseOver: stopCountdown, className: "fb-h-full fb-w-full", children })
  ] });
};
const StackedCardsContainer = ({
  cardArrangement,
  currentQuestionId,
  survey,
  getCardContent,
  styling,
  setQuestionId,
  shouldResetQuestionId = true,
  fullSizeCards = false
}) => {
  var _a2, _b, _c, _d, _e, _f;
  const [hovered, setHovered] = h(false);
  const highlightBorderColor = ((_b = (_a2 = survey.styling) == null ? void 0 : _a2.highlightBorderColor) == null ? void 0 : _b.light) || ((_c = styling.highlightBorderColor) == null ? void 0 : _c.light);
  const cardBorderColor = ((_e = (_d = survey.styling) == null ? void 0 : _d.cardBorderColor) == null ? void 0 : _e.light) || ((_f = styling.cardBorderColor) == null ? void 0 : _f.light);
  const cardRefs = A$1([]);
  const resizeObserver = A$1(null);
  const [cardHeight, setCardHeight] = h("auto");
  const [cardWidth, setCardWidth] = h(0);
  const questionIdxTemp = T$1(() => {
    if (currentQuestionId === "start") return survey.welcomeCard.enabled ? -1 : 0;
    if (!survey.questions.map((question) => question.id).includes(currentQuestionId)) {
      return survey.questions.length;
    }
    return survey.questions.findIndex((question) => question.id === currentQuestionId);
  }, [currentQuestionId, survey.welcomeCard.enabled, survey.questions.length]);
  const [prevQuestionIdx, setPrevQuestionIdx] = h(questionIdxTemp - 1);
  const [currentQuestionIdx, setCurrentQuestionIdx] = h(questionIdxTemp);
  const [nextQuestionIdx, setNextQuestionIdx] = h(questionIdxTemp + 1);
  const [visitedQuestions, setVisitedQuestions] = h([]);
  y(() => {
    if (questionIdxTemp > currentQuestionIdx) {
      setPrevQuestionIdx(currentQuestionIdx);
      setCurrentQuestionIdx(questionIdxTemp);
      setNextQuestionIdx(questionIdxTemp + 1);
      setVisitedQuestions((prev) => {
        return [...prev, currentQuestionIdx];
      });
    } else if (questionIdxTemp < currentQuestionIdx) {
      setNextQuestionIdx(currentQuestionIdx);
      setCurrentQuestionIdx(questionIdxTemp);
      setPrevQuestionIdx(visitedQuestions[visitedQuestions.length - 2]);
      setVisitedQuestions((prev) => {
        if (prev.length > 0) {
          const newStack = prev.slice(0, -1);
          return newStack;
        }
        return prev;
      });
    }
  }, [questionIdxTemp]);
  const borderStyles = T$1(() => {
    const baseStyle = {
      border: "1px solid",
      borderRadius: "var(--fb-border-radius)"
    };
    const borderColor = survey.type === "link" || !highlightBorderColor ? cardBorderColor : highlightBorderColor;
    return {
      ...baseStyle,
      borderColor
    };
  }, [survey.type, cardBorderColor, highlightBorderColor]);
  const calculateCardTransform = T$1(() => {
    const rotationCoefficient = cardWidth >= 1e3 ? 1.5 : cardWidth > 650 ? 2 : 3;
    return (offset) => {
      switch (cardArrangement) {
        case "casual":
          return offset < 0 ? `translateX(33%)` : `translateX(0) rotate(-${(hovered ? rotationCoefficient : rotationCoefficient - 0.5) * offset}deg)`;
        case "straight":
          return offset < 0 ? `translateY(25%)` : `translateY(-${(hovered ? 12 : 10) * offset}px)`;
        default:
          return offset < 0 ? `translateX(0)` : `translateX(0)`;
      }
    };
  }, [cardArrangement, hovered, cardWidth]);
  const straightCardArrangementStyles = (offset) => {
    if (cardArrangement === "straight") {
      return {
        width: `${100 - 5 * offset >= 100 ? 100 : 100 - 5 * offset}%`,
        margin: "auto"
      };
    }
  };
  y(() => {
    const timer = setTimeout(() => {
      const currentElement = cardRefs.current[questionIdxTemp];
      if (currentElement) {
        if (resizeObserver.current) {
          resizeObserver.current.disconnect();
        }
        resizeObserver.current = new ResizeObserver((entries) => {
          for (const entry of entries) {
            setCardHeight(entry.contentRect.height + "px");
            setCardWidth(entry.contentRect.width);
          }
        });
        resizeObserver.current.observe(currentElement);
      }
    }, 0);
    return () => {
      var _a3;
      (_a3 = resizeObserver.current) == null ? void 0 : _a3.disconnect();
      clearTimeout(timer);
    };
  }, [questionIdxTemp, cardArrangement, cardRefs]);
  y(() => {
    var _a3;
    if (shouldResetQuestionId) {
      setQuestionId(survey.welcomeCard.enabled ? "start" : (_a3 = survey == null ? void 0 : survey.questions[0]) == null ? void 0 : _a3.id);
    }
  }, [cardArrangement]);
  const getCardHeight = (offset) => {
    if (offset === 0) return "auto";
    else if (offset < 0) return "initial";
    else return cardHeight;
  };
  const getBottomStyles = () => {
    if (survey.type !== "link")
      return {
        bottom: 0
      };
  };
  return /* @__PURE__ */ u$1(
    "div",
    {
      className: "fb-relative fb-flex fb-h-full fb-items-end fb-justify-center md:fb-items-center",
      onMouseEnter: () => {
        setHovered(true);
      },
      onMouseLeave: () => setHovered(false),
      children: [
        /* @__PURE__ */ u$1("div", { style: { height: cardHeight } }),
        cardArrangement === "simple" ? /* @__PURE__ */ u$1(
          "div",
          {
            id: `questionCard-${questionIdxTemp}`,
            className: cn("fb-w-full fb-bg-survey-bg", fullSizeCards ? "fb-h-full" : ""),
            style: {
              ...borderStyles
            },
            children: getCardContent(questionIdxTemp, 0)
          }
        ) : questionIdxTemp !== void 0 && [prevQuestionIdx, currentQuestionIdx, nextQuestionIdx, nextQuestionIdx + 1].map(
          (questionIdxTemp2, index) => {
            const hasEndingCard = survey.endings.length > 0;
            if (questionIdxTemp2 > survey.questions.length + (hasEndingCard ? 0 : -1)) return;
            const offset = index - 1;
            const isHidden = offset < 0;
            return /* @__PURE__ */ u$1(
              "div",
              {
                ref: (el) => cardRefs.current[questionIdxTemp2] = el,
                id: `questionCard-${questionIdxTemp2}`,
                style: {
                  zIndex: 1e3 - questionIdxTemp2,
                  transform: `${calculateCardTransform(offset)}`,
                  opacity: isHidden ? 0 : (100 - 0 * offset) / 100,
                  height: fullSizeCards ? "100%" : getCardHeight(offset),
                  transitionDuration: "600ms",
                  pointerEvents: offset === 0 ? "auto" : "none",
                  ...borderStyles,
                  ...straightCardArrangementStyles(offset),
                  ...getBottomStyles()
                },
                className: "fb-pointer fb-rounded-custom fb-bg-survey-bg fb-absolute fb-inset-x-0 fb-backdrop-blur-md fb-transition-all fb-ease-in-out",
                children: getCardContent(questionIdxTemp2, offset)
              },
              questionIdxTemp2
            );
          }
        )
      ]
    }
  );
};
var sha3$1 = {};
var _assert = {};
Object.defineProperty(_assert, "__esModule", { value: true });
_assert.isBytes = isBytes;
_assert.number = number;
_assert.bool = bool;
_assert.bytes = bytes;
_assert.hash = hash$1;
_assert.exists = exists;
_assert.output = output;
function number(n2) {
  if (!Number.isSafeInteger(n2) || n2 < 0)
    throw new Error(`positive integer expected, not ${n2}`);
}
function bool(b2) {
  if (typeof b2 !== "boolean")
    throw new Error(`boolean expected, not ${b2}`);
}
function isBytes(a2) {
  return a2 instanceof Uint8Array || a2 != null && typeof a2 === "object" && a2.constructor.name === "Uint8Array";
}
function bytes(b2, ...lengths) {
  if (!isBytes(b2))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b2.length))
    throw new Error(`Uint8Array expected of length ${lengths}, not of length=${b2.length}`);
}
function hash$1(h2) {
  if (typeof h2 !== "function" || typeof h2.create !== "function")
    throw new Error("Hash should be wrapped by utils.wrapConstructor");
  number(h2.outputLen);
  number(h2.blockLen);
}
function exists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function output(out, instance) {
  bytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error(`digestInto() expects output buffer of length at least ${min}`);
  }
}
const assert = { number, bool, bytes, hash: hash$1, exists, output };
_assert.default = assert;
var _u64 = {};
Object.defineProperty(_u64, "__esModule", { value: true });
_u64.add5L = _u64.add5H = _u64.add4H = _u64.add4L = _u64.add3H = _u64.add3L = _u64.rotlBL = _u64.rotlBH = _u64.rotlSL = _u64.rotlSH = _u64.rotr32L = _u64.rotr32H = _u64.rotrBL = _u64.rotrBH = _u64.rotrSL = _u64.rotrSH = _u64.shrSL = _u64.shrSH = _u64.toBig = void 0;
_u64.fromBig = fromBig;
_u64.split = split;
_u64.add = add;
const U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
const _32n = /* @__PURE__ */ BigInt(32);
function fromBig(n2, le = false) {
  if (le)
    return { h: Number(n2 & U32_MASK64), l: Number(n2 >> _32n & U32_MASK64) };
  return { h: Number(n2 >> _32n & U32_MASK64) | 0, l: Number(n2 & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i2 = 0; i2 < lst.length; i2++) {
    const { h: h2, l: l2 } = fromBig(lst[i2], le);
    [Ah[i2], Al[i2]] = [h2, l2];
  }
  return [Ah, Al];
}
const toBig = (h2, l2) => BigInt(h2 >>> 0) << _32n | BigInt(l2 >>> 0);
_u64.toBig = toBig;
const shrSH = (h2, _l, s2) => h2 >>> s2;
_u64.shrSH = shrSH;
const shrSL = (h2, l2, s2) => h2 << 32 - s2 | l2 >>> s2;
_u64.shrSL = shrSL;
const rotrSH = (h2, l2, s2) => h2 >>> s2 | l2 << 32 - s2;
_u64.rotrSH = rotrSH;
const rotrSL = (h2, l2, s2) => h2 << 32 - s2 | l2 >>> s2;
_u64.rotrSL = rotrSL;
const rotrBH = (h2, l2, s2) => h2 << 64 - s2 | l2 >>> s2 - 32;
_u64.rotrBH = rotrBH;
const rotrBL = (h2, l2, s2) => h2 >>> s2 - 32 | l2 << 64 - s2;
_u64.rotrBL = rotrBL;
const rotr32H = (_h, l2) => l2;
_u64.rotr32H = rotr32H;
const rotr32L = (h2, _l) => h2;
_u64.rotr32L = rotr32L;
const rotlSH = (h2, l2, s2) => h2 << s2 | l2 >>> 32 - s2;
_u64.rotlSH = rotlSH;
const rotlSL = (h2, l2, s2) => l2 << s2 | h2 >>> 32 - s2;
_u64.rotlSL = rotlSL;
const rotlBH = (h2, l2, s2) => l2 << s2 - 32 | h2 >>> 64 - s2;
_u64.rotlBH = rotlBH;
const rotlBL = (h2, l2, s2) => h2 << s2 - 32 | l2 >>> 64 - s2;
_u64.rotlBL = rotlBL;
function add(Ah, Al, Bh, Bl) {
  const l2 = (Al >>> 0) + (Bl >>> 0);
  return { h: Ah + Bh + (l2 / 2 ** 32 | 0) | 0, l: l2 | 0 };
}
const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
_u64.add3L = add3L;
const add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
_u64.add3H = add3H;
const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
_u64.add4L = add4L;
const add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
_u64.add4H = add4H;
const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
_u64.add5L = add5L;
const add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;
_u64.add5H = add5H;
const u64 = {
  fromBig,
  split,
  toBig,
  shrSH,
  shrSL,
  rotrSH,
  rotrSL,
  rotrBH,
  rotrBL,
  rotr32H,
  rotr32L,
  rotlSH,
  rotlSL,
  rotlBH,
  rotlBL,
  add,
  add3L,
  add3H,
  add4L,
  add4H,
  add5H,
  add5L
};
_u64.default = u64;
var utils = {};
var crypto = {};
Object.defineProperty(crypto, "__esModule", { value: true });
crypto.crypto = void 0;
crypto.crypto = typeof globalThis === "object" && "crypto" in globalThis ? globalThis.crypto : void 0;
(function(exports) {
  /*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
  Object.defineProperty(exports, "__esModule", { value: true });
  exports.Hash = exports.nextTick = exports.byteSwapIfBE = exports.byteSwap = exports.isLE = exports.rotl = exports.rotr = exports.createView = exports.u32 = exports.u8 = void 0;
  exports.isBytes = isBytes2;
  exports.byteSwap32 = byteSwap32;
  exports.bytesToHex = bytesToHex;
  exports.hexToBytes = hexToBytes;
  exports.asyncLoop = asyncLoop;
  exports.utf8ToBytes = utf8ToBytes;
  exports.toBytes = toBytes;
  exports.concatBytes = concatBytes;
  exports.checkOpts = checkOpts;
  exports.wrapConstructor = wrapConstructor;
  exports.wrapConstructorWithOpts = wrapConstructorWithOpts;
  exports.wrapXOFConstructorWithOpts = wrapXOFConstructorWithOpts;
  exports.randomBytes = randomBytes;
  const crypto_1 = crypto;
  const _assert_js_12 = _assert;
  function isBytes2(a2) {
    return a2 instanceof Uint8Array || a2 != null && typeof a2 === "object" && a2.constructor.name === "Uint8Array";
  }
  const u8 = (arr) => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  exports.u8 = u8;
  const u32 = (arr) => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
  exports.u32 = u32;
  const createView = (arr) => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
  exports.createView = createView;
  const rotr = (word, shift) => word << 32 - shift | word >>> shift;
  exports.rotr = rotr;
  const rotl = (word, shift) => word << shift | word >>> 32 - shift >>> 0;
  exports.rotl = rotl;
  exports.isLE = new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68;
  const byteSwap = (word) => word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
  exports.byteSwap = byteSwap;
  exports.byteSwapIfBE = exports.isLE ? (n2) => n2 : (n2) => (0, exports.byteSwap)(n2);
  function byteSwap32(arr) {
    for (let i2 = 0; i2 < arr.length; i2++) {
      arr[i2] = (0, exports.byteSwap)(arr[i2]);
    }
  }
  const hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_2, i2) => i2.toString(16).padStart(2, "0"));
  function bytesToHex(bytes2) {
    (0, _assert_js_12.bytes)(bytes2);
    let hex = "";
    for (let i2 = 0; i2 < bytes2.length; i2++) {
      hex += hexes[bytes2[i2]];
    }
    return hex;
  }
  const asciis = { _0: 48, _9: 57, _A: 65, _F: 70, _a: 97, _f: 102 };
  function asciiToBase16(char) {
    if (char >= asciis._0 && char <= asciis._9)
      return char - asciis._0;
    if (char >= asciis._A && char <= asciis._F)
      return char - (asciis._A - 10);
    if (char >= asciis._a && char <= asciis._f)
      return char - (asciis._a - 10);
    return;
  }
  function hexToBytes(hex) {
    if (typeof hex !== "string")
      throw new Error("hex string expected, got " + typeof hex);
    const hl = hex.length;
    const al = hl / 2;
    if (hl % 2)
      throw new Error("padded hex string expected, got unpadded hex of length " + hl);
    const array = new Uint8Array(al);
    for (let ai = 0, hi = 0; ai < al; ai++, hi += 2) {
      const n1 = asciiToBase16(hex.charCodeAt(hi));
      const n2 = asciiToBase16(hex.charCodeAt(hi + 1));
      if (n1 === void 0 || n2 === void 0) {
        const char = hex[hi] + hex[hi + 1];
        throw new Error('hex string expected, got non-hex character "' + char + '" at index ' + hi);
      }
      array[ai] = n1 * 16 + n2;
    }
    return array;
  }
  const nextTick = async () => {
  };
  exports.nextTick = nextTick;
  async function asyncLoop(iters, tick, cb) {
    let ts = Date.now();
    for (let i2 = 0; i2 < iters; i2++) {
      cb(i2);
      const diff = Date.now() - ts;
      if (diff >= 0 && diff < tick)
        continue;
      await (0, exports.nextTick)();
      ts += diff;
    }
  }
  function utf8ToBytes(str) {
    if (typeof str !== "string")
      throw new Error(`utf8ToBytes expected string, got ${typeof str}`);
    return new Uint8Array(new TextEncoder().encode(str));
  }
  function toBytes(data) {
    if (typeof data === "string")
      data = utf8ToBytes(data);
    (0, _assert_js_12.bytes)(data);
    return data;
  }
  function concatBytes(...arrays) {
    let sum = 0;
    for (let i2 = 0; i2 < arrays.length; i2++) {
      const a2 = arrays[i2];
      (0, _assert_js_12.bytes)(a2);
      sum += a2.length;
    }
    const res = new Uint8Array(sum);
    for (let i2 = 0, pad = 0; i2 < arrays.length; i2++) {
      const a2 = arrays[i2];
      res.set(a2, pad);
      pad += a2.length;
    }
    return res;
  }
  class Hash {
    // Safe version that clones internal state
    clone() {
      return this._cloneInto();
    }
  }
  exports.Hash = Hash;
  const toStr = {}.toString;
  function checkOpts(defaults, opts) {
    if (opts !== void 0 && toStr.call(opts) !== "[object Object]")
      throw new Error("Options should be object or undefined");
    const merged = Object.assign(defaults, opts);
    return merged;
  }
  function wrapConstructor(hashCons) {
    const hashC = (msg) => hashCons().update(toBytes(msg)).digest();
    const tmp = hashCons();
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = () => hashCons();
    return hashC;
  }
  function wrapConstructorWithOpts(hashCons) {
    const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
    const tmp = hashCons({});
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = (opts) => hashCons(opts);
    return hashC;
  }
  function wrapXOFConstructorWithOpts(hashCons) {
    const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
    const tmp = hashCons({});
    hashC.outputLen = tmp.outputLen;
    hashC.blockLen = tmp.blockLen;
    hashC.create = (opts) => hashCons(opts);
    return hashC;
  }
  function randomBytes(bytesLength = 32) {
    if (crypto_1.crypto && typeof crypto_1.crypto.getRandomValues === "function") {
      return crypto_1.crypto.getRandomValues(new Uint8Array(bytesLength));
    }
    if (crypto_1.crypto && typeof crypto_1.crypto.randomBytes === "function") {
      return crypto_1.crypto.randomBytes(bytesLength);
    }
    throw new Error("crypto.getRandomValues must be defined");
  }
})(utils);
Object.defineProperty(sha3$1, "__esModule", { value: true });
sha3$1.shake256 = sha3$1.shake128 = sha3$1.keccak_512 = sha3$1.keccak_384 = sha3$1.keccak_256 = sha3$1.keccak_224 = sha3$1.sha3_512 = sha3$1.sha3_384 = sha3$1.sha3_256 = sha3$1.sha3_224 = sha3$1.Keccak = void 0;
sha3$1.keccakP = keccakP;
const _assert_js_1 = _assert;
const _u64_js_1 = _u64;
const utils_js_1 = utils;
const SHA3_PI = [];
const SHA3_ROTL = [];
const _SHA3_IOTA = [];
const _0n = /* @__PURE__ */ BigInt(0);
const _1n = /* @__PURE__ */ BigInt(1);
const _2n = /* @__PURE__ */ BigInt(2);
const _7n = /* @__PURE__ */ BigInt(7);
const _256n = /* @__PURE__ */ BigInt(256);
const _0x71n = /* @__PURE__ */ BigInt(113);
for (let round = 0, R2 = _1n, x2 = 1, y2 = 0; round < 24; round++) {
  [x2, y2] = [y2, (2 * x2 + 3 * y2) % 5];
  SHA3_PI.push(2 * (5 * y2 + x2));
  SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
  let t2 = _0n;
  for (let j2 = 0; j2 < 7; j2++) {
    R2 = (R2 << _1n ^ (R2 >> _7n) * _0x71n) % _256n;
    if (R2 & _2n)
      t2 ^= _1n << (_1n << /* @__PURE__ */ BigInt(j2)) - _1n;
  }
  _SHA3_IOTA.push(t2);
}
const [SHA3_IOTA_H, SHA3_IOTA_L] = /* @__PURE__ */ (0, _u64_js_1.split)(_SHA3_IOTA, true);
const rotlH = (h2, l2, s2) => s2 > 32 ? (0, _u64_js_1.rotlBH)(h2, l2, s2) : (0, _u64_js_1.rotlSH)(h2, l2, s2);
const rotlL = (h2, l2, s2) => s2 > 32 ? (0, _u64_js_1.rotlBL)(h2, l2, s2) : (0, _u64_js_1.rotlSL)(h2, l2, s2);
function keccakP(s2, rounds = 24) {
  const B2 = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x2 = 0; x2 < 10; x2++)
      B2[x2] = s2[x2] ^ s2[x2 + 10] ^ s2[x2 + 20] ^ s2[x2 + 30] ^ s2[x2 + 40];
    for (let x2 = 0; x2 < 10; x2 += 2) {
      const idx1 = (x2 + 8) % 10;
      const idx0 = (x2 + 2) % 10;
      const B0 = B2[idx0];
      const B1 = B2[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B2[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B2[idx1 + 1];
      for (let y2 = 0; y2 < 50; y2 += 10) {
        s2[x2 + y2] ^= Th;
        s2[x2 + y2 + 1] ^= Tl;
      }
    }
    let curH = s2[2];
    let curL = s2[3];
    for (let t2 = 0; t2 < 24; t2++) {
      const shift = SHA3_ROTL[t2];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t2];
      curH = s2[PI];
      curL = s2[PI + 1];
      s2[PI] = Th;
      s2[PI + 1] = Tl;
    }
    for (let y2 = 0; y2 < 50; y2 += 10) {
      for (let x2 = 0; x2 < 10; x2++)
        B2[x2] = s2[y2 + x2];
      for (let x2 = 0; x2 < 10; x2++)
        s2[y2 + x2] ^= ~B2[(x2 + 2) % 10] & B2[(x2 + 4) % 10];
    }
    s2[0] ^= SHA3_IOTA_H[round];
    s2[1] ^= SHA3_IOTA_L[round];
  }
  B2.fill(0);
}
class Keccak extends utils_js_1.Hash {
  // NOTE: we accept arguments in bytes instead of bits here.
  constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
    super();
    this.blockLen = blockLen;
    this.suffix = suffix;
    this.outputLen = outputLen;
    this.enableXOF = enableXOF;
    this.rounds = rounds;
    this.pos = 0;
    this.posOut = 0;
    this.finished = false;
    this.destroyed = false;
    (0, _assert_js_1.number)(outputLen);
    if (0 >= this.blockLen || this.blockLen >= 200)
      throw new Error("Sha3 supports only keccak-f1600 function");
    this.state = new Uint8Array(200);
    this.state32 = (0, utils_js_1.u32)(this.state);
  }
  keccak() {
    if (!utils_js_1.isLE)
      (0, utils_js_1.byteSwap32)(this.state32);
    keccakP(this.state32, this.rounds);
    if (!utils_js_1.isLE)
      (0, utils_js_1.byteSwap32)(this.state32);
    this.posOut = 0;
    this.pos = 0;
  }
  update(data) {
    (0, _assert_js_1.exists)(this);
    const { blockLen, state } = this;
    data = (0, utils_js_1.toBytes)(data);
    const len = data.length;
    for (let pos = 0; pos < len; ) {
      const take = Math.min(blockLen - this.pos, len - pos);
      for (let i2 = 0; i2 < take; i2++)
        state[this.pos++] ^= data[pos++];
      if (this.pos === blockLen)
        this.keccak();
    }
    return this;
  }
  finish() {
    if (this.finished)
      return;
    this.finished = true;
    const { state, suffix, pos, blockLen } = this;
    state[pos] ^= suffix;
    if ((suffix & 128) !== 0 && pos === blockLen - 1)
      this.keccak();
    state[blockLen - 1] ^= 128;
    this.keccak();
  }
  writeInto(out) {
    (0, _assert_js_1.exists)(this, false);
    (0, _assert_js_1.bytes)(out);
    this.finish();
    const bufferOut = this.state;
    const { blockLen } = this;
    for (let pos = 0, len = out.length; pos < len; ) {
      if (this.posOut >= blockLen)
        this.keccak();
      const take = Math.min(blockLen - this.posOut, len - pos);
      out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
      this.posOut += take;
      pos += take;
    }
    return out;
  }
  xofInto(out) {
    if (!this.enableXOF)
      throw new Error("XOF is not possible for this instance");
    return this.writeInto(out);
  }
  xof(bytes2) {
    (0, _assert_js_1.number)(bytes2);
    return this.xofInto(new Uint8Array(bytes2));
  }
  digestInto(out) {
    (0, _assert_js_1.output)(out, this);
    if (this.finished)
      throw new Error("digest() was already called");
    this.writeInto(out);
    this.destroy();
    return out;
  }
  digest() {
    return this.digestInto(new Uint8Array(this.outputLen));
  }
  destroy() {
    this.destroyed = true;
    this.state.fill(0);
  }
  _cloneInto(to) {
    const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
    to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
    to.state32.set(this.state32);
    to.pos = this.pos;
    to.posOut = this.posOut;
    to.finished = this.finished;
    to.rounds = rounds;
    to.suffix = suffix;
    to.outputLen = outputLen;
    to.enableXOF = enableXOF;
    to.destroyed = this.destroyed;
    return to;
  }
}
sha3$1.Keccak = Keccak;
const gen = (suffix, blockLen, outputLen) => (0, utils_js_1.wrapConstructor)(() => new Keccak(blockLen, suffix, outputLen));
sha3$1.sha3_224 = gen(6, 144, 224 / 8);
sha3$1.sha3_256 = gen(6, 136, 256 / 8);
sha3$1.sha3_384 = gen(6, 104, 384 / 8);
sha3$1.sha3_512 = gen(6, 72, 512 / 8);
sha3$1.keccak_224 = gen(1, 144, 224 / 8);
sha3$1.keccak_256 = gen(1, 136, 256 / 8);
sha3$1.keccak_384 = gen(1, 104, 384 / 8);
sha3$1.keccak_512 = gen(1, 72, 512 / 8);
const genShake = (suffix, blockLen, outputLen) => (0, utils_js_1.wrapXOFConstructorWithOpts)((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === void 0 ? outputLen : opts.dkLen, true));
sha3$1.shake128 = genShake(31, 168, 128 / 8);
sha3$1.shake256 = genShake(31, 136, 256 / 8);
const { sha3_512: sha3 } = sha3$1;
const defaultLength = 24;
const bigLength = 32;
const createEntropy = (length = 4, random = Math.random) => {
  let entropy = "";
  while (entropy.length < length) {
    entropy = entropy + Math.floor(random() * 36).toString(36);
  }
  return entropy;
};
function bufToBigInt(buf) {
  let bits = 8n;
  let value = 0n;
  for (const i2 of buf.values()) {
    const bi = BigInt(i2);
    value = (value << bits) + bi;
  }
  return value;
}
const hash = (input = "") => {
  return bufToBigInt(sha3(input)).toString(36).slice(1);
};
const alphabet = Array.from(
  { length: 26 },
  (x2, i2) => String.fromCharCode(i2 + 97)
);
const randomLetter = (random) => alphabet[Math.floor(random() * alphabet.length)];
const createFingerprint = ({
  globalObj = typeof commonjsGlobal !== "undefined" ? commonjsGlobal : typeof window !== "undefined" ? window : {},
  random = Math.random
} = {}) => {
  const globals = Object.keys(globalObj).toString();
  const sourceString = globals.length ? globals + createEntropy(bigLength, random) : createEntropy(bigLength, random);
  return hash(sourceString).substring(0, bigLength);
};
const createCounter = (count) => () => {
  return count++;
};
const initialCountMax = 476782367;
const init = ({
  // Fallback if the user does not pass in a CSPRNG. This should be OK
  // because we don't rely solely on the random number generator for entropy.
  // We also use the host fingerprint, current time, and a session counter.
  random = Math.random,
  counter = createCounter(Math.floor(random() * initialCountMax)),
  length = defaultLength,
  fingerprint = createFingerprint({ random })
} = {}) => {
  return function cuid2() {
    const firstLetter = randomLetter(random);
    const time = Date.now().toString(36);
    const count = counter().toString(36);
    const salt = createEntropy(length, random);
    const hashInput = `${time + salt + count + fingerprint}`;
    return `${firstLetter + hash(hashInput).substring(1, length)}`;
  };
};
init();
const isConditionGroup = (condition) => {
  return condition.connector !== void 0;
};
const evaluateLogic = (localSurvey, data, variablesData, conditions, selectedLanguage) => {
  const evaluateConditionGroup = (group) => {
    const results = group.conditions.map((condition) => {
      if (isConditionGroup(condition)) {
        return evaluateConditionGroup(condition);
      } else {
        return evaluateSingleCondition(localSurvey, data, variablesData, condition, selectedLanguage);
      }
    });
    return group.connector === "or" ? results.some((r2) => r2) : results.every((r2) => r2);
  };
  return evaluateConditionGroup(conditions);
};
const evaluateSingleCondition = (localSurvey, data, variablesData, condition, selectedLanguage) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i;
  try {
    let leftValue = getLeftOperandValue(
      localSurvey,
      data,
      variablesData,
      condition.leftOperand,
      selectedLanguage
    );
    let rightValue = condition.rightOperand ? getRightOperandValue(localSurvey, data, variablesData, condition.rightOperand) : void 0;
    let leftField;
    if (((_a2 = condition.leftOperand) == null ? void 0 : _a2.type) === "question") {
      leftField = localSurvey.questions.find((q2) => {
        var _a3;
        return q2.id === ((_a3 = condition.leftOperand) == null ? void 0 : _a3.value);
      });
    } else if (((_b = condition.leftOperand) == null ? void 0 : _b.type) === "variable") {
      leftField = localSurvey.variables.find((v2) => {
        var _a3;
        return v2.id === ((_a3 = condition.leftOperand) == null ? void 0 : _a3.value);
      });
    } else if (((_c = condition.leftOperand) == null ? void 0 : _c.type) === "hiddenField") {
      leftField = condition.leftOperand.value;
    } else {
      leftField = "";
    }
    let rightField;
    if (((_d = condition.rightOperand) == null ? void 0 : _d.type) === "question") {
      rightField = localSurvey.questions.find(
        (q2) => {
          var _a3;
          return q2.id === ((_a3 = condition.rightOperand) == null ? void 0 : _a3.value);
        }
      );
    } else if (((_e = condition.rightOperand) == null ? void 0 : _e.type) === "variable") {
      rightField = localSurvey.variables.find(
        (v2) => {
          var _a3;
          return v2.id === ((_a3 = condition.rightOperand) == null ? void 0 : _a3.value);
        }
      );
    } else if (((_f = condition.rightOperand) == null ? void 0 : _f.type) === "hiddenField") {
      rightField = condition.rightOperand.value;
    } else {
      rightField = "";
    }
    if (condition.leftOperand.type === "variable" && leftField.type === "number" && ((_g = condition.rightOperand) == null ? void 0 : _g.type) === "hiddenField") {
      rightValue = Number(rightValue);
    }
    switch (condition.operator) {
      case "equals":
        if (condition.leftOperand.type === "question") {
          if (leftField.type === TSurveyQuestionTypeEnum.Date && typeof leftValue === "string" && typeof rightValue === "string") {
            return new Date(leftValue).getTime() === new Date(rightValue).getTime();
          }
        }
        if (((_h = condition.rightOperand) == null ? void 0 : _h.type) === "question") {
          if (rightField.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return rightValue.includes(leftValue);
            } else return false;
          } else if (rightField.type === TSurveyQuestionTypeEnum.Date && typeof leftValue === "string" && typeof rightValue === "string") {
            return new Date(leftValue).getTime() === new Date(rightValue).getTime();
          }
        }
        return Array.isArray(leftValue) && leftValue.length === 1 && typeof rightValue === "string" && leftValue.includes(rightValue) || leftValue === rightValue;
      case "doesNotEqual":
        if (condition.leftOperand.type === "question" && leftField.type === TSurveyQuestionTypeEnum.PictureSelection && Array.isArray(leftValue) && leftValue.length > 0 && typeof rightValue === "string") {
          return !leftValue.includes(rightValue);
        }
        if (condition.leftOperand.type === "question" && leftField.type === TSurveyQuestionTypeEnum.Date && typeof leftValue === "string" && typeof rightValue === "string") {
          return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
        }
        if (((_i = condition.rightOperand) == null ? void 0 : _i.type) === "question") {
          if (rightField.type === TSurveyQuestionTypeEnum.MultipleChoiceMulti) {
            if (Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.length === 1) {
              return !rightValue.includes(leftValue);
            } else return false;
          } else if (rightField.type === TSurveyQuestionTypeEnum.Date && typeof leftValue === "string" && typeof rightValue === "string") {
            return new Date(leftValue).getTime() !== new Date(rightValue).getTime();
          }
        }
        return Array.isArray(leftValue) && leftValue.length === 1 && typeof rightValue === "string" && !leftValue.includes(rightValue) || leftValue !== rightValue;
      case "contains":
        return String(leftValue).includes(String(rightValue));
      case "doesNotContain":
        return !String(leftValue).includes(String(rightValue));
      case "startsWith":
        return String(leftValue).startsWith(String(rightValue));
      case "doesNotStartWith":
        return !String(leftValue).startsWith(String(rightValue));
      case "endsWith":
        return String(leftValue).endsWith(String(rightValue));
      case "doesNotEndWith":
        return !String(leftValue).endsWith(String(rightValue));
      case "isSubmitted":
        if (typeof leftValue === "string") {
          if (condition.leftOperand.type === "question" && leftField.type === TSurveyQuestionTypeEnum.FileUpload && leftValue) {
            return leftValue !== "skipped";
          }
          return leftValue !== "" && leftValue !== null;
        } else if (Array.isArray(leftValue)) {
          return leftValue.length > 0;
        } else if (typeof leftValue === "number") {
          return leftValue !== null;
        }
        return false;
      case "isSkipped":
        return Array.isArray(leftValue) && leftValue.length === 0 || leftValue === "" || leftValue === null || leftValue === void 0 || typeof leftValue === "object" && Object.entries(leftValue).length === 0;
      case "isGreaterThan":
        return Number(leftValue) > Number(rightValue);
      case "isLessThan":
        return Number(leftValue) < Number(rightValue);
      case "isGreaterThanOrEqual":
        return Number(leftValue) >= Number(rightValue);
      case "isLessThanOrEqual":
        return Number(leftValue) <= Number(rightValue);
      case "equalsOneOf":
        return Array.isArray(rightValue) && typeof leftValue === "string" && rightValue.includes(leftValue);
      case "includesAllOf":
        return Array.isArray(leftValue) && Array.isArray(rightValue) && rightValue.every((v2) => leftValue.includes(v2));
      case "includesOneOf":
        return Array.isArray(leftValue) && Array.isArray(rightValue) && rightValue.some((v2) => leftValue.includes(v2));
      case "isAccepted":
        return leftValue === "accepted";
      case "isClicked":
        return leftValue === "clicked";
      case "isAfter":
        return new Date(String(leftValue)) > new Date(String(rightValue));
      case "isBefore":
        return new Date(String(leftValue)) < new Date(String(rightValue));
      case "isBooked":
        return leftValue === "booked" || !!(leftValue && leftValue !== "");
      case "isPartiallySubmitted":
        if (typeof leftValue === "object") {
          return Object.values(leftValue).includes("");
        } else return false;
      case "isCompletelySubmitted":
        if (typeof leftValue === "object") {
          const values = Object.values(leftValue);
          return values.length > 0 && !values.includes("");
        } else return false;
      default:
        return false;
    }
  } catch (e2) {
    return false;
  }
};
const getVariableValue = (variables, variableId, variablesData) => {
  const variable = variables.find((v2) => v2.id === variableId);
  if (!variable) return void 0;
  const variableValue = variablesData[variableId];
  return variable.type === "number" ? Number(variableValue) || 0 : variableValue || "";
};
const getLeftOperandValue = (localSurvey, data, variablesData, leftOperand, selectedLanguage) => {
  var _a2;
  switch (leftOperand.type) {
    case "question":
      const currentQuestion = localSurvey.questions.find((q2) => q2.id === leftOperand.value);
      if (!currentQuestion) return void 0;
      const responseValue = data[leftOperand.value];
      if (currentQuestion.type === "openText" && currentQuestion.inputType === "number") {
        return Number(responseValue) || void 0;
      }
      if (currentQuestion.type === "multipleChoiceSingle" || currentQuestion.type === "multipleChoiceMulti") {
        const isOthersEnabled = ((_a2 = currentQuestion.choices.at(-1)) == null ? void 0 : _a2.id) === "other";
        if (typeof responseValue === "string") {
          const choice = currentQuestion.choices.find((choice2) => {
            return getLocalizedValue(choice2.label, selectedLanguage) === responseValue;
          });
          if (!choice) {
            if (isOthersEnabled) {
              return "other";
            }
            return void 0;
          }
          return choice.id;
        } else if (Array.isArray(responseValue)) {
          let choices = [];
          responseValue.forEach((value) => {
            const foundChoice = currentQuestion.choices.find((choice) => {
              return getLocalizedValue(choice.label, selectedLanguage) === value;
            });
            if (foundChoice) {
              choices.push(foundChoice.id);
            } else if (isOthersEnabled) {
              choices.push("other");
            }
          });
          if (choices) {
            return Array.from(new Set(choices));
          }
        }
      }
      return data[leftOperand.value];
    case "variable":
      const variables = localSurvey.variables || [];
      return getVariableValue(variables, leftOperand.value, variablesData);
    case "hiddenField":
      return data[leftOperand.value];
    default:
      return void 0;
  }
};
const getRightOperandValue = (localSurvey, data, variablesData, rightOperand) => {
  if (!rightOperand) return void 0;
  switch (rightOperand.type) {
    case "question":
      return data[rightOperand.value];
    case "variable":
      const variables = localSurvey.variables || [];
      return getVariableValue(variables, rightOperand.value, variablesData);
    case "hiddenField":
      return data[rightOperand.value];
    case "static":
      return rightOperand.value;
    default:
      return void 0;
  }
};
const performActions = (survey, actions, data, calculationResults) => {
  let jumpTarget;
  const requiredQuestionIds = [];
  const calculations = { ...calculationResults };
  actions.forEach((action) => {
    switch (action.objective) {
      case "calculate":
        const result = performCalculation(survey, action, data, calculations);
        if (result !== void 0) calculations[action.variableId] = result;
        break;
      case "requireAnswer":
        requiredQuestionIds.push(action.target);
        break;
      case "jumpToQuestion":
        if (!jumpTarget) {
          jumpTarget = action.target;
        }
        break;
    }
  });
  return { jumpTarget, requiredQuestionIds, calculations };
};
const performCalculation = (survey, action, data, calculations) => {
  const variables = survey.variables || [];
  const variable = variables.find((v2) => v2.id === action.variableId);
  if (!variable) return void 0;
  let currentValue = calculations[action.variableId];
  if (currentValue === void 0) {
    currentValue = variable.type === "number" ? 0 : "";
  }
  let operandValue;
  switch (action.value.type) {
    case "static":
      operandValue = action.value.value;
      break;
    case "variable":
      const value = calculations[action.value.value];
      if (typeof value === "number" || typeof value === "string") {
        operandValue = value;
      }
      break;
    case "question":
    case "hiddenField":
      const val = data[action.value.value];
      if (typeof val === "number" || typeof val === "string") {
        if (variable.type === "number" && !isNaN(Number(val))) {
          operandValue = Number(val);
        }
        operandValue = val;
      }
      break;
  }
  if (operandValue === void 0 || operandValue === null) return void 0;
  let result;
  switch (action.operator) {
    case "add":
      result = Number(currentValue) + Number(operandValue);
      break;
    case "subtract":
      result = Number(currentValue) - Number(operandValue);
      break;
    case "multiply":
      result = Number(currentValue) * Number(operandValue);
      break;
    case "divide":
      if (Number(operandValue) === 0) return void 0;
      result = Number(currentValue) / Number(operandValue);
      break;
    case "assign":
      result = operandValue;
      break;
    case "concat":
      result = String(currentValue) + String(operandValue);
      break;
  }
  return result;
};
const Survey = ({
  survey,
  styling,
  isBrandingEnabled,
  onDisplay = () => {
  },
  onResponse = () => {
  },
  onClose = () => {
  },
  onFinished = () => {
  },
  onRetry = () => {
  },
  isRedirectDisabled = false,
  prefillResponseData,
  skipPrefilled,
  languageCode,
  getSetIsError,
  getSetIsResponseSendingFinished,
  getSetQuestionId,
  getSetResponseData,
  onFileUpload,
  responseCount,
  startAtQuestionId,
  hiddenFieldsRecord,
  clickOutside,
  shouldResetQuestionId,
  fullSizeCards = false,
  autoFocus
}) => {
  var _a2, _b;
  const [localSurvey, setlocalSurvey] = h(survey);
  y(() => {
    setlocalSurvey(survey);
  }, [survey]);
  const autoFocusEnabled = autoFocus !== void 0 ? autoFocus : window.self === window.top;
  const [questionId, setQuestionId] = h(() => {
    var _a3;
    if (startAtQuestionId) {
      return startAtQuestionId;
    } else if (localSurvey.welcomeCard.enabled) {
      return "start";
    } else {
      return (_a3 = localSurvey == null ? void 0 : localSurvey.questions[0]) == null ? void 0 : _a3.id;
    }
  });
  const [showError, setShowError] = h(false);
  const [isResponseSendingFinished, setIsResponseSendingFinished] = h(
    getSetIsResponseSendingFinished ? false : true
  );
  const [selectedLanguage, setselectedLanguage] = h(languageCode);
  const [loadingElement, setLoadingElement] = h(false);
  const [history, setHistory] = h([]);
  const [responseData, setResponseData] = h(hiddenFieldsRecord ?? {});
  const [_variableStack, setVariableStack] = h([]);
  const [currentVariables, setCurrentVariables] = h(() => {
    return localSurvey.variables.reduce((acc, variable) => {
      acc[variable.id] = variable.value;
      return acc;
    }, {});
  });
  const [ttc, setTtc] = h({});
  const questionIds = T$1(
    () => localSurvey.questions.map((question) => question.id),
    [localSurvey.questions]
  );
  const cardArrangement = T$1(() => {
    var _a3, _b2;
    if (localSurvey.type === "link") {
      return ((_a3 = styling.cardArrangement) == null ? void 0 : _a3.linkSurveys) ?? "straight";
    } else {
      return ((_b2 = styling.cardArrangement) == null ? void 0 : _b2.appSurveys) ?? "straight";
    }
  }, [localSurvey.type, (_a2 = styling.cardArrangement) == null ? void 0 : _a2.linkSurveys, (_b = styling.cardArrangement) == null ? void 0 : _b.appSurveys]);
  const currentQuestionIndex = localSurvey.questions.findIndex((q2) => q2.id === questionId);
  const currentQuestion = T$1(() => {
    if (!questionIds.includes(questionId)) {
      const newHistory = [...history];
      const prevQuestionId = newHistory.pop();
      return localSurvey.questions.find((q2) => q2.id === prevQuestionId);
    } else {
      return localSurvey.questions.find((q2) => q2.id === questionId);
    }
  }, [questionId, localSurvey, history]);
  const contentRef = A$1(null);
  const showProgressBar = !styling.hideProgressBar;
  const getShowSurveyCloseButton = (offset) => {
    return offset === 0 && localSurvey.type !== "link" && (clickOutside === void 0 ? true : clickOutside);
  };
  const getShowLanguageSwitch = (offset) => {
    return localSurvey.showLanguageSwitch && localSurvey.languages.length > 0 && offset <= 0;
  };
  y(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [questionId]);
  y(() => {
    onDisplay();
  }, []);
  y(() => {
    if (getSetIsError) {
      getSetIsError((value) => {
        setShowError(value);
      });
    }
  }, [getSetIsError]);
  y(() => {
    if (getSetQuestionId) {
      getSetQuestionId((value) => {
        setQuestionId(value);
      });
    }
  }, [getSetQuestionId]);
  y(() => {
    if (getSetResponseData) {
      getSetResponseData((value) => {
        setResponseData(value);
      });
    }
  }, [getSetResponseData]);
  y(() => {
    if (getSetIsResponseSendingFinished) {
      getSetIsResponseSendingFinished((value) => {
        setIsResponseSendingFinished(value);
      });
    }
  }, [getSetIsResponseSendingFinished]);
  y(() => {
    setselectedLanguage(languageCode);
  }, [languageCode]);
  let currIdxTemp = currentQuestionIndex;
  let currQuesTemp = currentQuestion;
  const onChange = (responseDataUpdate) => {
    const updatedResponseData = { ...responseData, ...responseDataUpdate };
    setResponseData(updatedResponseData);
  };
  const onChangeVariables = (variables) => {
    const updatedVariables = { ...currentVariables, ...variables };
    setCurrentVariables(updatedVariables);
  };
  const makeQuestionsRequired = (questionIds2) => {
    setlocalSurvey((prevSurvey) => ({
      ...prevSurvey,
      questions: prevSurvey.questions.map((question) => {
        if (questionIds2.includes(question.id)) {
          return {
            ...question,
            required: true
          };
        }
        return question;
      })
    }));
  };
  const pushVariableState = (questionId2) => {
    setVariableStack((prevStack) => [...prevStack, { questionId: questionId2, variables: { ...currentVariables } }]);
  };
  const popVariableState = () => {
    setVariableStack((prevStack) => {
      const newStack = [...prevStack];
      const poppedState = newStack.pop();
      if (poppedState) {
        setCurrentVariables(poppedState.variables);
      }
      return newStack;
    });
  };
  const evaluateLogicAndGetNextQuestionId = (data) => {
    var _a3, _b2;
    const questions = survey.questions;
    const firstEndingId = survey.endings.length > 0 ? survey.endings[0].id : void 0;
    if (questionId === "start")
      return { nextQuestionId: ((_a3 = questions[0]) == null ? void 0 : _a3.id) || firstEndingId, calculatedVariables: {} };
    if (!currQuesTemp) throw new Error("Question not found");
    let firstJumpTarget;
    const allRequiredQuestionIds = [];
    let calculationResults = { ...currentVariables };
    const localResponseData = { ...responseData, ...data };
    if (currQuesTemp.logic && currQuesTemp.logic.length > 0) {
      for (const logic of currQuesTemp.logic) {
        if (evaluateLogic(
          localSurvey,
          localResponseData,
          calculationResults,
          logic.conditions,
          selectedLanguage
        )) {
          const { jumpTarget, requiredQuestionIds, calculations } = performActions(
            localSurvey,
            logic.actions,
            localResponseData,
            calculationResults
          );
          if (jumpTarget && !firstJumpTarget) {
            firstJumpTarget = jumpTarget;
          }
          allRequiredQuestionIds.push(...requiredQuestionIds);
          calculationResults = { ...calculationResults, ...calculations };
        }
      }
    }
    if (allRequiredQuestionIds.length > 0) {
      makeQuestionsRequired(allRequiredQuestionIds);
    }
    const nextQuestionId = firstJumpTarget || ((_b2 = questions[currentQuestionIndex + 1]) == null ? void 0 : _b2.id) || firstEndingId;
    return { nextQuestionId, calculatedVariables: calculationResults };
  };
  const onSubmit = (responseData2, ttc2) => {
    const questionId2 = Object.keys(responseData2)[0];
    setLoadingElement(true);
    pushVariableState(questionId2);
    const { nextQuestionId, calculatedVariables } = evaluateLogicAndGetNextQuestionId(responseData2);
    const finished = nextQuestionId === void 0 || !localSurvey.questions.map((question) => question.id).includes(nextQuestionId);
    onChange(responseData2);
    onChangeVariables(calculatedVariables);
    onResponse({
      data: responseData2,
      ttc: ttc2,
      finished,
      variables: calculatedVariables,
      language: selectedLanguage
    });
    if (finished) {
      window.parent.postMessage("formbricksSurveyCompleted", "*");
      onFinished();
    }
    if (nextQuestionId) {
      setQuestionId(nextQuestionId);
    }
    setHistory([...history, questionId2]);
    setLoadingElement(false);
  };
  const onBack = () => {
    var _a3;
    let prevQuestionId;
    if ((history == null ? void 0 : history.length) > 0) {
      const newHistory = [...history];
      prevQuestionId = newHistory.pop();
      setHistory(newHistory);
    } else {
      prevQuestionId = (_a3 = localSurvey.questions[currIdxTemp - 1]) == null ? void 0 : _a3.id;
    }
    popVariableState();
    if (!prevQuestionId) throw new Error("Question not found");
    setQuestionId(prevQuestionId);
  };
  const getQuestionPrefillData = (questionId2, offset) => {
    if (offset === 0 && prefillResponseData) {
      return prefillResponseData[questionId2];
    }
    return void 0;
  };
  const getCardContent = (questionIdx, offset) => {
    if (showError) {
      return /* @__PURE__ */ u$1(
        ResponseErrorComponent,
        {
          responseData,
          questions: localSurvey.questions,
          onRetry
        }
      );
    }
    const content = () => {
      var _a3;
      if (questionIdx === -1) {
        return /* @__PURE__ */ u$1(
          WelcomeCard,
          {
            headline: localSurvey.welcomeCard.headline,
            html: localSurvey.welcomeCard.html,
            fileUrl: localSurvey.welcomeCard.fileUrl,
            buttonLabel: localSurvey.welcomeCard.buttonLabel,
            onSubmit,
            survey: localSurvey,
            languageCode: selectedLanguage,
            responseCount,
            autoFocusEnabled,
            isCurrent: offset === 0,
            responseData,
            variablesData: currentVariables
          },
          "start"
        );
      } else if (questionIdx >= localSurvey.questions.length) {
        const endingCard = localSurvey.endings.find((ending) => {
          return ending.id === questionId;
        });
        if (endingCard) {
          return /* @__PURE__ */ u$1(
            EndingCard,
            {
              survey: localSurvey,
              endingCard,
              isRedirectDisabled,
              autoFocusEnabled,
              isCurrent: offset === 0,
              languageCode: selectedLanguage,
              isResponseSendingFinished,
              responseData,
              variablesData: currentVariables
            }
          );
        }
      } else {
        const question = localSurvey.questions[questionIdx];
        return question && /* @__PURE__ */ u$1(
          QuestionConditional,
          {
            surveyId: localSurvey.id,
            question: parseRecallInformation(question, selectedLanguage, responseData, currentVariables),
            value: responseData[question.id],
            onChange,
            onSubmit,
            onBack,
            ttc,
            setTtc,
            onFileUpload,
            isFirstQuestion: question.id === ((_a3 = localSurvey == null ? void 0 : localSurvey.questions[0]) == null ? void 0 : _a3.id),
            skipPrefilled,
            prefilledQuestionValue: getQuestionPrefillData(question.id, offset),
            isLastQuestion: question.id === localSurvey.questions[localSurvey.questions.length - 1].id,
            languageCode: selectedLanguage,
            autoFocusEnabled,
            currentQuestionId: questionId
          },
          question.id
        );
      }
    };
    return /* @__PURE__ */ u$1(AutoCloseWrapper, { survey: localSurvey, onClose, offset, children: /* @__PURE__ */ u$1(
      "div",
      {
        className: cn(
          "fb-no-scrollbar md:fb-rounded-custom fb-rounded-t-custom fb-bg-survey-bg fb-flex fb-h-full fb-w-full fb-flex-col fb-justify-between fb-overflow-hidden fb-transition-all fb-duration-1000 fb-ease-in-out",
          cardArrangement === "simple" ? "fb-survey-shadow" : "",
          offset === 0 || cardArrangement === "simple" ? "fb-opacity-100" : "fb-opacity-0"
        ),
        children: [
          /* @__PURE__ */ u$1("div", { className: "fb-flex fb-h-6 fb-justify-end fb-pr-2 fb-pt-2", children: [
            getShowLanguageSwitch(offset) && /* @__PURE__ */ u$1(
              LanguageSwitch,
              {
                surveyLanguages: localSurvey.languages,
                setSelectedLanguageCode: setselectedLanguage
              }
            ),
            getShowSurveyCloseButton(offset) && /* @__PURE__ */ u$1(SurveyCloseButton, { onClose })
          ] }),
          /* @__PURE__ */ u$1(
            "div",
            {
              ref: contentRef,
              className: cn(
                loadingElement ? "fb-animate-pulse fb-opacity-60" : "",
                fullSizeCards ? "" : "fb-my-auto"
              ),
              children: content()
            }
          ),
          /* @__PURE__ */ u$1("div", { className: "fb-mx-6 fb-mb-10 fb-mt-2 fb-space-y-3 md:fb-mb-6 md:fb-mt-6", children: [
            isBrandingEnabled && /* @__PURE__ */ u$1(FormbricksBranding, {}),
            showProgressBar && /* @__PURE__ */ u$1(ProgressBar, { survey: localSurvey, questionId })
          ] })
        ]
      }
    ) });
  };
  return /* @__PURE__ */ u$1(b, { children: /* @__PURE__ */ u$1(
    StackedCardsContainer,
    {
      cardArrangement,
      currentQuestionId: questionId,
      getCardContent,
      survey: localSurvey,
      styling,
      setQuestionId,
      shouldResetQuestionId,
      fullSizeCards
    }
  ) });
};
const SurveyInline = (props) => {
  return /* @__PURE__ */ u$1(
    "div",
    {
      id: "fbjs",
      className: "fb-formbricks-form",
      style: {
        height: "100%",
        width: "100%"
      },
      children: /* @__PURE__ */ u$1(Survey, { ...props })
    }
  );
};
const Modal = ({ children, isOpen, placement, clickOutside, darkOverlay, onClose }) => {
  const [show, setShow] = h(false);
  const isCenter = placement === "center";
  const modalRef = A$1(null);
  y(() => {
    setShow(isOpen);
  }, [isOpen]);
  y(() => {
    if (!isCenter) return;
    const handleClickOutside = (e2) => {
      if (clickOutside && show && modalRef.current && !modalRef.current.contains(e2.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [show, clickOutside, onClose, isCenter]);
  const getPlacementStyle = (placement2) => {
    switch (placement2) {
      case "bottomRight":
        return "sm:fb-bottom-3 sm:fb-right-3";
      case "topRight":
        return "sm:fb-top-3 sm:fb-right-3 sm:fb-bottom-3";
      case "topLeft":
        return "sm:fb-top-3 sm:fb-left-3 sm:fb-bottom-3";
      case "bottomLeft":
        return "sm:fb-bottom-3 sm:fb-left-3";
      case "center":
        return "sm:fb-top-1/2 sm:fb-left-1/2 sm:fb-transform sm:-fb-translate-x-1/2 sm:-fb-translate-y-1/2";
      default:
        return "sm:fb-bottom-3 sm:fb-right-3";
    }
  };
  if (!show) return null;
  return /* @__PURE__ */ u$1(
    "div",
    {
      "aria-live": "assertive",
      className: cn(
        isCenter ? "fb-pointer-events-auto" : "fb-pointer-events-none",
        "fb-z-999999 fb-fixed fb-inset-0 fb-flex fb-items-end"
      ),
      children: /* @__PURE__ */ u$1(
        "div",
        {
          className: cn(
            "fb-relative fb-h-full fb-w-full",
            isCenter ? darkOverlay ? "fb-bg-gray-700/80" : "fb-bg-white/50" : "fb-bg-none fb-transition-all fb-duration-500 fb-ease-in-out"
          ),
          children: /* @__PURE__ */ u$1(
            "div",
            {
              ref: modalRef,
              className: cn(
                getPlacementStyle(placement),
                show ? "fb-opacity-100" : "fb-opacity-0",
                "fb-rounded-custom fb-pointer-events-auto fb-absolute fb-bottom-0 fb-h-fit fb-w-full fb-overflow-visible fb-bg-white fb-shadow-lg fb-transition-all fb-duration-500 fb-ease-in-out sm:fb-m-4 sm:fb-max-w-sm"
              ),
              children: /* @__PURE__ */ u$1("div", { children })
            }
          )
        }
      )
    }
  );
};
const SurveyModal = ({
  survey,
  isBrandingEnabled,
  getSetIsError,
  placement,
  clickOutside,
  darkOverlay,
  onDisplay,
  getSetIsResponseSendingFinished,
  onResponse,
  onClose,
  onFinished = () => {
  },
  onFileUpload,
  onRetry,
  isRedirectDisabled = false,
  languageCode,
  responseCount,
  styling,
  hiddenFieldsRecord
}) => {
  var _a2;
  const [isOpen, setIsOpen] = h(true);
  const close = () => {
    setIsOpen(false);
    setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 1e3);
  };
  const highlightBorderColor = ((_a2 = styling == null ? void 0 : styling.highlightBorderColor) == null ? void 0 : _a2.light) || null;
  return /* @__PURE__ */ u$1("div", { id: "fbjs", className: "fb-formbricks-form", children: /* @__PURE__ */ u$1(
    Modal,
    {
      placement,
      clickOutside,
      darkOverlay,
      highlightBorderColor,
      isOpen,
      onClose: close,
      children: /* @__PURE__ */ u$1(
        Survey,
        {
          survey,
          isBrandingEnabled,
          onDisplay,
          getSetIsResponseSendingFinished,
          onResponse,
          languageCode,
          onClose: close,
          onFinished: () => {
            onFinished();
            setTimeout(
              () => {
                const firstEnabledEnding = survey.endings[0];
                if ((firstEnabledEnding == null ? void 0 : firstEnabledEnding.type) !== "redirectToUrl") {
                  close();
                }
              },
              survey.endings.length ? 3e3 : 0
              // close modal automatically after 3 seconds if no ending is enabled; otherwise, close immediately
            );
          },
          onRetry,
          getSetIsError,
          onFileUpload,
          isRedirectDisabled,
          responseCount,
          styling,
          isCardBorderVisible: !highlightBorderColor,
          clickOutside: placement === "center" ? clickOutside : void 0,
          hiddenFieldsRecord
        }
      )
    }
  ) });
};
const global$1 = "*,:before,:after{--tw-border-spacing-x: 0;--tw-border-spacing-y: 0;--tw-translate-x: 0;--tw-translate-y: 0;--tw-rotate: 0;--tw-skew-x: 0;--tw-skew-y: 0;--tw-scale-x: 1;--tw-scale-y: 1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness: proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-color: rgb(59 130 246 / .5);--tw-ring-offset-shadow: 0 0 #0000;--tw-ring-shadow: 0 0 #0000;--tw-shadow: 0 0 #0000;--tw-shadow-colored: 0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }::backdrop{--tw-border-spacing-x: 0;--tw-border-spacing-y: 0;--tw-translate-x: 0;--tw-translate-y: 0;--tw-rotate: 0;--tw-skew-x: 0;--tw-skew-y: 0;--tw-scale-x: 1;--tw-scale-y: 1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness: proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width: 0px;--tw-ring-offset-color: #fff;--tw-ring-color: rgb(59 130 246 / .5);--tw-ring-offset-shadow: 0 0 #0000;--tw-ring-shadow: 0 0 #0000;--tw-shadow: 0 0 #0000;--tw-shadow-colored: 0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }#fbjs .fb-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border-width:0}#fbjs .fb-pointer-events-none{pointer-events:none}#fbjs .fb-pointer-events-auto{pointer-events:auto}#fbjs .fb-invisible{visibility:hidden}#fbjs .fb-fixed{position:fixed}#fbjs .fb-absolute{position:absolute}#fbjs .fb-relative{position:relative}#fbjs .fb-sticky{position:sticky}#fbjs .fb-inset-0{top:0;right:0;bottom:0;left:0}#fbjs .fb-inset-auto{inset:auto}#fbjs .fb-inset-x-0{left:0;right:0}#fbjs .-fb-bottom-2{bottom:-.5em}#fbjs .fb-bottom-0{bottom:0}#fbjs .fb-bottom-2{bottom:.5em}#fbjs .fb-left-0{left:0}#fbjs .fb-right-0{right:0}#fbjs .fb-right-2{right:.5em}#fbjs .fb-right-8{right:2em}#fbjs .fb-top-0{top:0}#fbjs .fb-top-10{top:2.5em}#fbjs .fb-top-2{top:.5em}#fbjs .fb-z-10{z-index:10}#fbjs .fb-z-20{z-index:20}#fbjs .fb-z-999999{z-index:999999}#fbjs .fb-z-\\[1001\\]{z-index:1001}#fbjs .fb-m-2{margin:.5em}#fbjs .fb-mx-2{margin-left:.5em;margin-right:.5em}#fbjs .fb-mx-6{margin-left:1.5em;margin-right:1.5em}#fbjs .fb-my-2{margin-top:.5em;margin-bottom:.5em}#fbjs .fb-my-3{margin-top:.75em;margin-bottom:.75em}#fbjs .fb-my-4{margin-top:1em;margin-bottom:1em}#fbjs .fb-my-auto{margin-top:auto;margin-bottom:auto}#fbjs .fb-mb-1\\.5{margin-bottom:.375em}#fbjs .fb-mb-10{margin-bottom:2.5em}#fbjs .fb-mb-2{margin-bottom:.5em}#fbjs .fb-mb-4{margin-bottom:1em}#fbjs .fb-mb-8{margin-bottom:2em}#fbjs .fb-mb-\\[10px\\]{margin-bottom:10px}#fbjs .fb-ml-3{margin-left:.75em}#fbjs .fb-ml-6{margin-left:1.5em}#fbjs .fb-mr-1{margin-right:.25em}#fbjs .fb-mr-3{margin-right:.75em}#fbjs .fb-mr-4{margin-right:1em}#fbjs .fb-mt-1{margin-top:.25em}#fbjs .fb-mt-10{margin-top:2.5em}#fbjs .fb-mt-2{margin-top:.5em}#fbjs .fb-mt-3{margin-top:.75em}#fbjs .fb-mt-4{margin-top:1em}#fbjs .fb-mt-6{margin-top:1.5em}#fbjs .fb-block{display:block}#fbjs .fb-inline-block{display:inline-block}#fbjs .fb-flex{display:flex}#fbjs .fb-grid{display:grid}#fbjs .fb-hidden{display:none}#fbjs .fb-aspect-\\[4\\/3\\]{aspect-ratio:4/3}#fbjs .fb-aspect-video{aspect-ratio:16 / 9}#fbjs .fb-h-1{height:.25em}#fbjs .fb-h-10{height:2.5em}#fbjs .fb-h-12{height:3em}#fbjs .fb-h-2{height:.5em}#fbjs .fb-h-24{height:6em}#fbjs .fb-h-4{height:1em}#fbjs .fb-h-5{height:1.25em}#fbjs .fb-h-6{height:1.5em}#fbjs .fb-h-8{height:2em}#fbjs .fb-h-9{height:2.25em}#fbjs .fb-h-\\[12dvh\\]{height:12dvh}#fbjs .fb-h-\\[46dvh\\]{height:46dvh}#fbjs .fb-h-\\[46px\\]{height:46px}#fbjs .fb-h-\\[6px\\]{height:6px}#fbjs .fb-h-fit{height:-moz-fit-content;height:fit-content}#fbjs .fb-h-full{height:100%}#fbjs .fb-max-h-16{max-height:4em}#fbjs .fb-max-h-36{max-height:9em}#fbjs .fb-max-h-96{max-height:24em}#fbjs .fb-max-h-\\[50vh\\]{max-height:50vh}#fbjs .fb-min-h-40{min-height:10em}#fbjs .fb-min-h-9{min-height:2.25em}#fbjs .fb-min-h-\\[41px\\]{min-height:41px}#fbjs .fb-min-h-\\[47px\\]{min-height:47px}#fbjs .fb-min-h-\\[7rem\\]{min-height:7em}#fbjs .fb-w-1\\/2{width:50%}#fbjs .fb-w-1\\/3{width:33.333333%}#fbjs .fb-w-16{width:4em}#fbjs .fb-w-24{width:6em}#fbjs .fb-w-4{width:1em}#fbjs .fb-w-5{width:1.25em}#fbjs .fb-w-6{width:1.5em}#fbjs .fb-w-fit{width:-moz-fit-content;width:fit-content}#fbjs .fb-w-full{width:100%}#fbjs .fb-min-w-full{min-width:100%}#fbjs .fb-max-w-40{max-width:10em}#fbjs .fb-max-w-\\[74px\\]{max-width:74px}#fbjs .fb-max-w-md{max-width:28em}#fbjs .fb-flex-1{flex:1 1 0%}#fbjs .fb-shrink{flex-shrink:1}#fbjs .fb-grow{flex-grow:1}#fbjs .fb-grow-0{flex-grow:0}#fbjs .fb-table-auto{table-layout:auto}#fbjs .fb-border-collapse{border-collapse:collapse}#fbjs .fb-transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}@keyframes fb-pulse{50%{opacity:.5}}#fbjs .fb-animate-pulse{animation:fb-pulse 2s cubic-bezier(.4,0,.6,1) infinite}@keyframes fb-spin{to{transform:rotate(360deg)}}#fbjs .fb-animate-spin{animation:fb-spin 1s linear infinite}#fbjs .fb-cursor-not-allowed{cursor:not-allowed}#fbjs .fb-cursor-pointer{cursor:pointer}#fbjs .fb-appearance-none{-webkit-appearance:none;-moz-appearance:none;appearance:none}#fbjs .fb-grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}#fbjs .fb-flex-row{flex-direction:row}#fbjs .fb-flex-col{flex-direction:column}#fbjs .fb-items-end{align-items:flex-end}#fbjs .fb-items-center{align-items:center}#fbjs .fb-justify-end{justify-content:flex-end}#fbjs .fb-justify-center{justify-content:center}#fbjs .fb-justify-between{justify-content:space-between}#fbjs .fb-gap-2{gap:.5em}#fbjs .fb-gap-4{gap:1em}#fbjs .fb-gap-x-4{-moz-column-gap:1em;column-gap:1em}#fbjs :is(.fb-space-x-2>:not([hidden])~:not([hidden])){--tw-space-x-reverse: 0;margin-right:calc(.5em * var(--tw-space-x-reverse));margin-left:calc(.5em * calc(1 - var(--tw-space-x-reverse)))}#fbjs :is(.fb-space-y-2>:not([hidden])~:not([hidden])){--tw-space-y-reverse: 0;margin-top:calc(.5em * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.5em * var(--tw-space-y-reverse))}#fbjs :is(.fb-space-y-3>:not([hidden])~:not([hidden])){--tw-space-y-reverse: 0;margin-top:calc(.75em * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.75em * var(--tw-space-y-reverse))}#fbjs :is(.fb-space-y-4>:not([hidden])~:not([hidden])){--tw-space-y-reverse: 0;margin-top:calc(1em * calc(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1em * var(--tw-space-y-reverse))}#fbjs .fb-self-start{align-self:flex-start}#fbjs .fb-overflow-auto{overflow:auto}#fbjs .fb-overflow-hidden{overflow:hidden}#fbjs .fb-overflow-visible{overflow:visible}#fbjs .fb-overflow-x-auto{overflow-x:auto}#fbjs .fb-overflow-y-scroll{overflow-y:scroll}#fbjs .fb-overflow-ellipsis{text-overflow:ellipsis}#fbjs .fb-whitespace-nowrap{white-space:nowrap}#fbjs .fb-break-words{overflow-wrap:break-word}#fbjs .fb-rounded-\\[100\\%\\]{border-radius:100%}#fbjs .fb-rounded-custom{border-radius:var(--fb-border-radius)}#fbjs .fb-rounded-full{border-radius:9999px}#fbjs .fb-rounded-lg{border-radius:.5em}#fbjs .fb-rounded-md{border-radius:.375em}#fbjs .fb-rounded-l-custom{border-top-left-radius:var(--fb-border-radius);border-bottom-left-radius:var(--fb-border-radius)}#fbjs .fb-rounded-r-custom{border-top-right-radius:var(--fb-border-radius);border-bottom-right-radius:var(--fb-border-radius)}#fbjs .fb-rounded-t-custom{border-top-left-radius:var(--fb-border-radius);border-top-right-radius:var(--fb-border-radius)}#fbjs .fb-rounded-br-custom{border-bottom-right-radius:var(--fb-border-radius)}#fbjs .fb-rounded-tr-custom{border-top-right-radius:var(--fb-border-radius)}#fbjs .fb-border{border-width:1px}#fbjs .fb-border-2{border-width:2px}#fbjs .fb-border-4{border-width:4px}#fbjs .fb-border-b{border-bottom-width:1px}#fbjs .fb-border-l{border-left-width:1px}#fbjs .fb-border-r{border-right-width:1px}#fbjs .fb-border-t{border-top-width:1px}#fbjs .fb-border-dashed{border-style:dashed}#fbjs .\\!fb-border-border-highlight{border-color:var(--fb-border-color-highlight)!important}#fbjs .fb-border-back-button-border{border-color:var(--fb-back-btn-border)}#fbjs .fb-border-border{border-color:var(--fb-border-color)}#fbjs .fb-border-border-highlight{border-color:var(--fb-border-color-highlight)}#fbjs .fb-border-brand{border-color:var(--fb-brand-color)}#fbjs .fb-border-red-500{--tw-border-opacity: 1;border-color:rgb(239 68 68 / var(--tw-border-opacity))}#fbjs .fb-border-slate-200{--tw-border-opacity: 1;border-color:rgb(226 232 240 / var(--tw-border-opacity))}#fbjs .fb-border-submit-button-border{border-color:var(--fb-submit-btn-border)}#fbjs .\\!fb-bg-brand{background-color:var(--fb-brand-color)!important}#fbjs .\\!fb-bg-input-bg{background-color:var(--fb-input-background-color)!important}#fbjs .fb-bg-accent-bg{background-color:var(--fb-accent-background-color)}#fbjs .fb-bg-accent-selected-bg{background-color:var(--fb-accent-background-color-selected)}#fbjs .fb-bg-black{--tw-bg-opacity: 1;background-color:rgb(0 0 0 / var(--tw-bg-opacity))}#fbjs .fb-bg-brand{background-color:var(--fb-brand-color)}#fbjs .fb-bg-emerald-100{--tw-bg-opacity: 1;background-color:rgb(209 250 229 / var(--tw-bg-opacity))}#fbjs .fb-bg-gray-700\\/80{background-color:#374151cc}#fbjs .fb-bg-gray-800{--tw-bg-opacity: 1;background-color:rgb(31 41 55 / var(--tw-bg-opacity))}#fbjs .fb-bg-input-bg{background-color:var(--fb-input-background-color)}#fbjs .fb-bg-input-bg-selected{background-color:var(--fb-input-background-color-selected)}#fbjs .fb-bg-orange-100{--tw-bg-opacity: 1;background-color:rgb(255 237 213 / var(--tw-bg-opacity))}#fbjs .fb-bg-rose-100{--tw-bg-opacity: 1;background-color:rgb(255 228 230 / var(--tw-bg-opacity))}#fbjs .fb-bg-slate-100{--tw-bg-opacity: 1;background-color:rgb(241 245 249 / var(--tw-bg-opacity))}#fbjs .fb-bg-slate-200{--tw-bg-opacity: 1;background-color:rgb(226 232 240 / var(--tw-bg-opacity))}#fbjs .fb-bg-survey-bg{background-color:var(--fb-survey-background-color)}#fbjs .fb-bg-white{--tw-bg-opacity: 1;background-color:rgb(255 255 255 / var(--tw-bg-opacity))}#fbjs .fb-bg-white\\/50{background-color:#ffffff80}#fbjs .fb-bg-opacity-40{--tw-bg-opacity: .4}#fbjs .fb-bg-gradient-to-b{background-image:linear-gradient(to bottom,var(--tw-gradient-stops))}#fbjs .fb-bg-gradient-to-t{background-image:linear-gradient(to top,var(--tw-gradient-stops))}#fbjs .fb-bg-none{background-image:none}#fbjs .fb-from-survey-bg{--tw-gradient-from: var(--fb-survey-background-color) var(--tw-gradient-from-position);--tw-gradient-to: rgb(255 255 255 / 0) var(--tw-gradient-to-position);--tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to)}#fbjs .fb-to-transparent{--tw-gradient-to: transparent var(--tw-gradient-to-position)}#fbjs .fb-fill-emerald-100{fill:#d1fae5}#fbjs .fb-fill-emerald-300{fill:#6ee7b7}#fbjs .fb-fill-none{fill:none}#fbjs .fb-fill-orange-100{fill:#ffedd5}#fbjs .fb-fill-orange-300{fill:#fdba74}#fbjs .fb-fill-rating-fill{fill:var(--fb-rating-fill)}#fbjs .fb-fill-rose-100{fill:#ffe4e6}#fbjs .fb-fill-rose-300{fill:#fda4af}#fbjs .fb-stroke-heading{stroke:var(--fb-heading-color)}#fbjs .fb-stroke-rating-selected{stroke:var(--fb-rating-selected)}#fbjs .fb-object-contain{-o-object-fit:contain;object-fit:contain}#fbjs .fb-object-cover{-o-object-fit:cover;object-fit:cover}#fbjs .fb-p-0{padding:0}#fbjs .fb-p-0\\.5{padding:.125em}#fbjs .fb-p-1\\.5{padding:.375em}#fbjs .fb-p-2{padding:.5em}#fbjs .fb-p-3{padding:.75em}#fbjs .fb-p-4{padding:1em}#fbjs .fb-px-1{padding-left:.25em;padding-right:.25em}#fbjs .fb-px-1\\.5{padding-left:.375em;padding-right:.375em}#fbjs .fb-px-2{padding-left:.5em;padding-right:.5em}#fbjs .fb-px-3{padding-left:.75em;padding-right:.75em}#fbjs .fb-px-4{padding-left:1em;padding-right:1em}#fbjs .fb-px-6{padding-left:1.5em;padding-right:1.5em}#fbjs .fb-py-1{padding-top:.25em;padding-bottom:.25em}#fbjs .fb-py-2{padding-top:.5em;padding-bottom:.5em}#fbjs .fb-py-3{padding-top:.75em;padding-bottom:.75em}#fbjs .fb-py-4{padding-top:1em;padding-bottom:1em}#fbjs .fb-py-5{padding-top:1.25em;padding-bottom:1.25em}#fbjs .fb-py-6{padding-top:1.5em;padding-bottom:1.5em}#fbjs .fb-pb-1{padding-bottom:.25em}#fbjs .fb-pl-2{padding-left:.5em}#fbjs .fb-pr-2{padding-right:.5em}#fbjs .fb-pr-4{padding-right:1em}#fbjs .fb-pt-1{padding-top:.25em}#fbjs .fb-pt-2{padding-top:.5em}#fbjs .fb-text-left{text-align:left}#fbjs .fb-text-center{text-align:center}#fbjs .fb-text-right{text-align:right}#fbjs .fb-text-base{font-size:1em;line-height:1.5em}#fbjs .fb-text-sm{font-size:.875em;line-height:1.25em}#fbjs .fb-text-xs{font-size:.75em;line-height:1em}#fbjs .fb-font-bold{font-weight:700}#fbjs .fb-font-medium{font-weight:500}#fbjs .fb-font-normal{font-weight:400}#fbjs .fb-font-semibold{font-weight:600}#fbjs .fb-leading-10{line-height:2.5em}#fbjs .fb-leading-4{line-height:1em}#fbjs .fb-leading-5{line-height:1.25em}#fbjs .fb-leading-6{line-height:1.5em}#fbjs .fb-leading-7{line-height:1.75em}#fbjs .fb-leading-\\[3\\.5em\\]{line-height:3.5em}#fbjs .\\!fb-text-heading{color:var(--fb-heading-color)!important}#fbjs .fb-text-\\[\\#8696AC\\]{--tw-text-opacity: 1;color:rgb(134 150 172 / var(--tw-text-opacity))}#fbjs .fb-text-amber-400{--tw-text-opacity: 1;color:rgb(251 191 36 / var(--tw-text-opacity))}#fbjs .fb-text-brand{color:var(--fb-brand-color)}#fbjs .fb-text-branding-text{color:var(--fb-branding-text-color)}#fbjs .fb-text-gray-800{--tw-text-opacity: 1;color:rgb(31 41 55 / var(--tw-text-opacity))}#fbjs .fb-text-heading{color:var(--fb-heading-color)}#fbjs .fb-text-on-brand{color:var(--fb-brand-text-color)}#fbjs .fb-text-placeholder{color:var(--fb-placeholder-color)}#fbjs .fb-text-rating-selected{color:var(--fb-rating-selected)}#fbjs .fb-text-red-500{--tw-text-opacity: 1;color:rgb(239 68 68 / var(--tw-text-opacity))}#fbjs .fb-text-red-600{--tw-text-opacity: 1;color:rgb(220 38 38 / var(--tw-text-opacity))}#fbjs .fb-text-signature{color:var(--fb-signature-text-color)}#fbjs .fb-text-slate-600{--tw-text-opacity: 1;color:rgb(71 85 105 / var(--tw-text-opacity))}#fbjs .fb-text-slate-900{--tw-text-opacity: 1;color:rgb(15 23 42 / var(--tw-text-opacity))}#fbjs .fb-text-subheading{color:var(--fb-subheading-color)}#fbjs .fb-text-transparent{color:transparent}#fbjs .fb-text-white{--tw-text-opacity: 1;color:rgb(255 255 255 / var(--tw-text-opacity))}#fbjs .fb-opacity-0{opacity:0}#fbjs .fb-opacity-100{opacity:1}#fbjs .fb-opacity-25{opacity:.25}#fbjs .fb-opacity-30{opacity:.3}#fbjs .fb-opacity-60{opacity:.6}#fbjs .fb-opacity-75{opacity:.75}#fbjs .fb-shadow-lg{--tw-shadow: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);--tw-shadow-colored: 0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}#fbjs .fb-shadow-sm{--tw-shadow: 0 1px 2px 0 rgb(0 0 0 / .05);--tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000),var(--tw-ring-shadow, 0 0 #0000),var(--tw-shadow)}#fbjs .fb-outline-brand{outline-color:var(--fb-brand-color)}#fbjs .fb-backdrop-blur-lg{--tw-backdrop-blur: blur(16px);-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}#fbjs .fb-backdrop-blur-md{--tw-backdrop-blur: blur(12px);-webkit-backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia);backdrop-filter:var(--tw-backdrop-blur) var(--tw-backdrop-brightness) var(--tw-backdrop-contrast) var(--tw-backdrop-grayscale) var(--tw-backdrop-hue-rotate) var(--tw-backdrop-invert) var(--tw-backdrop-opacity) var(--tw-backdrop-saturate) var(--tw-backdrop-sepia)}#fbjs .fb-transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,-webkit-backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter,-webkit-backdrop-filter;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}#fbjs .fb-transition-all{transition-property:all;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}#fbjs .fb-transition-colors{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}#fbjs .fb-duration-1000{transition-duration:1s}#fbjs .fb-duration-300{transition-duration:.3s}#fbjs .fb-duration-500{transition-duration:.5s}#fbjs .fb-ease-in-out{transition-timing-function:cubic-bezier(.4,0,.2,1)}#fbjs{font-size:16px}#fbjs *::-webkit-scrollbar{width:6px;background:transparent}#fbjs *::-webkit-scrollbar-track{background:transparent}#fbjs *::-webkit-scrollbar-thumb{background-color:var(--fb-brand-color);border:none;border-radius:10px}#fbjs *{scrollbar-width:thin;scrollbar-color:var(--fb-brand-color) transparent}.fb-htmlbody{display:block;font-size:.875em;font-weight:400;line-height:1.5em;color:var(--fb-subheading-color)!important}p.fb-editor-paragraph{overflow-wrap:break-word}.fb-survey-shadow{box-shadow:0 0 90px -40px var(--fb-survey-shadow-color)}:root{--brand-default: #64748b;--slate-50: rgb(248, 250, 252);--slate-100: rgb(241 245 249);--slate-200: rgb(226 232 240);--slate-300: rgb(203, 213, 225);--slate-400: rgb(148 163 184);--slate-500: rgb(100 116 139);--slate-600: rgb(71 85 105);--slate-700: rgb(51 65 85);--slate-800: rgb(30 41 59);--slate-900: rgb(15 23 42);--gray-100: rgb(243 244 246);--gray-200: rgb(229 231 235);--yellow-100: rgb(254 249 195);--yellow-300: rgb(253 224 71);--yellow-500: rgb(234 179 8);--fb-brand-color: var(--brand-default);--fb-brand-text-color: black;--fb-border-color: var(--slate-300);--fb-border-color-highlight: var(--slate-500);--fb-focus-color: var(--slate-500);--fb-heading-color: var(--slate-900);--fb-subheading-color: var(--slate-700);--fb-placeholder-color: var(--slate-300);--fb-info-text-color: var(--slate-500);--fb-signature-text-color: var(--slate-400);--fb-branding-text-color: var(--slate-500);--fb-survey-background-color: white;--fb-survey-border-color: var(--slate-50);--fb-survey-shadow-color: rgba(0, 0, 0, .4);--fb-accent-background-color: var(--slate-200);--fb-accent-background-color-selected: var(--slate-100);--fb-input-background-color: var(--slate-50);--fb-input-background-color-selected: var(--slate-200);--fb-placeholder-color: var(--slate-400);--fb-shadow-color: var(--slate-300);--fb-rating-fill: var(--yellow-100);--fb-rating-hover: var(--yellow-500);--fb-back-btn-border: transparent;--fb-submit-btn-border: transparent;--fb-rating-selected: black;--fb-close-btn-color: var(--slate-500);--fb-close-btn-color-hover: var(--slate-700);--fb-border-radius: 8px}@keyframes shrink-width-to-zero{0%{width:100%}to{width:0%}}.fb-no-scrollbar{-ms-overflow-style:none!important;scrollbar-width:thin!important;scrollbar-color:transparent transparent!important}.fb-no-scrollbar::-webkit-scrollbar{width:0!important;background:transparent!important}.fb-no-scrollbar::-webkit-scrollbar-thumb{background:transparent!important}#fbjs .placeholder\\:fb-text-placeholder::-moz-placeholder{color:var(--fb-placeholder-color)}#fbjs .placeholder\\:fb-text-placeholder::placeholder{color:var(--fb-placeholder-color)}#fbjs .first\\:fb-rounded-l-custom:first-child{border-top-left-radius:var(--fb-border-radius);border-bottom-left-radius:var(--fb-border-radius)}#fbjs .last\\:fb-rounded-r-custom:last-child{border-top-right-radius:var(--fb-border-radius);border-bottom-right-radius:var(--fb-border-radius)}#fbjs .last\\:fb-border-r:last-child{border-right-width:1px}#fbjs .even\\:fb-border-l:nth-child(2n){border-left-width:1px}#fbjs .even\\:fb-pl-1:nth-child(2n){padding-left:.25em}#fbjs .even\\:fb-pr-1:nth-child(2n){padding-right:.25em}#fbjs .focus-within\\:fb-border-brand:focus-within{border-color:var(--fb-brand-color)}#fbjs .focus-within\\:fb-bg-input-bg-selected:focus-within{background-color:var(--fb-input-background-color-selected)}#fbjs .hover\\:fb-cursor-pointer:hover{cursor:pointer}#fbjs .hover\\:fb-bg-black\\/5:hover{background-color:#0000000d}#fbjs .hover\\:fb-bg-input-bg-selected:hover{background-color:var(--fb-input-background-color-selected)}#fbjs .hover\\:fb-bg-opacity-65:hover{--tw-bg-opacity: .65}#fbjs .hover\\:fb-text-signature:hover{color:var(--fb-signature-text-color)}#fbjs .hover\\:fb-opacity-80:hover{opacity:.8}#fbjs .hover\\:fb-opacity-90:hover{opacity:.9}#fbjs .focus\\:fb-border-2:focus{border-width:2px}#fbjs .focus\\:fb-border-4:focus{border-width:4px}#fbjs .focus\\:fb-border-accent-bg:focus{border-color:var(--fb-accent-background-color)}#fbjs .focus\\:fb-border-brand:focus{border-color:var(--fb-brand-color)}#fbjs .focus\\:fb-bg-input-bg-selected:focus{background-color:var(--fb-input-background-color-selected)}#fbjs .focus\\:fb-bg-slate-200:focus{--tw-bg-opacity: 1;background-color:rgb(226 232 240 / var(--tw-bg-opacity))}#fbjs .focus\\:fb-outline-none:focus{outline:2px solid transparent;outline-offset:2px}#fbjs .focus\\:fb-outline-brand:focus{outline-color:var(--fb-brand-color)}#fbjs .focus\\:fb-ring-0:focus{--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(0px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow, 0 0 #0000)}#fbjs .focus\\:fb-ring-2:focus{--tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow, 0 0 #0000)}#fbjs .focus\\:fb-ring-brand:focus{--tw-ring-color: var(--fb-brand-color)}#fbjs .focus\\:fb-ring-focus:focus{--tw-ring-color: var(--fb-focus-color)}#fbjs .focus\\:fb-ring-offset-0:focus{--tw-ring-offset-width: 0px}#fbjs .focus\\:fb-ring-offset-2:focus{--tw-ring-offset-width: 2px}#fbjs .disabled\\:fb-cursor-not-allowed:disabled{cursor:not-allowed}#fbjs .disabled\\:fb-opacity-50:disabled{opacity:.5}#fbjs :is(.fb-group:hover .group-hover\\:fb-bg-white){--tw-bg-opacity: 1;background-color:rgb(255 255 255 / var(--tw-bg-opacity))}#fbjs :is(.fb-group:hover .group-hover\\:fb-text-heading){color:var(--fb-heading-color)}#fbjs :is(.fb-group\\/image:hover .group-hover\\/image\\:fb-opacity-100){opacity:1}#fbjs .aria-selected\\:fb-opacity-100[aria-selected=true]{opacity:1}#fbjs .dark\\:fb-border-slate-500:is(.fb-dark *){--tw-border-opacity: 1;border-color:rgb(100 116 139 / var(--tw-border-opacity))}#fbjs .dark\\:fb-border-slate-600:is(.fb-dark *){--tw-border-opacity: 1;border-color:rgb(71 85 105 / var(--tw-border-opacity))}#fbjs .dark\\:fb-bg-slate-700:is(.fb-dark *){--tw-bg-opacity: 1;background-color:rgb(51 65 85 / var(--tw-bg-opacity))}#fbjs .dark\\:fb-text-slate-300:is(.fb-dark *){--tw-text-opacity: 1;color:rgb(203 213 225 / var(--tw-text-opacity))}#fbjs .dark\\:fb-text-slate-400:is(.fb-dark *){--tw-text-opacity: 1;color:rgb(148 163 184 / var(--tw-text-opacity))}#fbjs .dark\\:hover\\:fb-border-slate-500:hover:is(.fb-dark *){--tw-border-opacity: 1;border-color:rgb(100 116 139 / var(--tw-border-opacity))}#fbjs .dark\\:hover\\:fb-bg-slate-800:hover:is(.fb-dark *){--tw-bg-opacity: 1;background-color:rgb(30 41 59 / var(--tw-bg-opacity))}@media (min-width: 640px){#fbjs .sm\\:fb-bottom-3{bottom:.75em}#fbjs .sm\\:fb-left-1\\/2{left:50%}#fbjs .sm\\:fb-left-3{left:.75em}#fbjs .sm\\:fb-right-3{right:.75em}#fbjs .sm\\:fb-top-1\\/2{top:50%}#fbjs .sm\\:fb-top-3{top:.75em}#fbjs .sm\\:fb-m-4{margin:1em}#fbjs .sm\\:fb-h-\\[33dvh\\]{height:33dvh}#fbjs .sm\\:fb-h-\\[34dvh\\]{height:34dvh}#fbjs .sm\\:fb-max-w-sm{max-width:24em}#fbjs .sm\\:-fb-translate-x-1\\/2{--tw-translate-x: -50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}#fbjs .sm\\:-fb-translate-y-1\\/2{--tw-translate-y: -50%;transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}#fbjs .sm\\:fb-transform{transform:translate(var(--tw-translate-x),var(--tw-translate-y)) rotate(var(--tw-rotate)) skew(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y))}#fbjs .sm\\:fb-text-sm{font-size:.875em;line-height:1.25em}}@media (min-width: 768px){#fbjs .md\\:fb-mb-6{margin-bottom:1.5em}#fbjs .md\\:fb-mt-6{margin-top:1.5em}#fbjs .md\\:fb-items-center{align-items:center}#fbjs .md\\:fb-rounded-custom{border-radius:var(--fb-border-radius)}}";
const preflight = '#fbjs *,#fbjs :before,#fbjs :after{box-sizing:border-box;border-width:0;border-style:solid;border-color:#e5e7eb;font-family:Inter,Helvetica,Arial,sans-serif;font-size:1em}#fbjs :before,#fbjs :after{--tw-content: ""}#fbjs html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4}#fbjs body{margin:0;line-height:inherit}#fbjs hr{height:0;color:inherit;border-top-width:1px}#fbjs abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}#fbjs h1,#fbjs h2,#fbjs h3,#fbjs h4,#fbjs h5,#fbjs h6{font-size:inherit;font-weight:inherit}#fbjs a{color:inherit;text-decoration:inherit}#fbjs b,#fbjs strong{font-weight:bolder}#fbjs code,#fbjs kbd,#fbjs samp,#fbjs pre{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace;font-size:1em}#fbjs small{font-size:80%}#fbjs sub,#fbjs sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}#fbjs sub{bottom:-.25em}#fbjs sup{top:-.5em}#fbjs table{text-indent:0;border-color:inherit;border-collapse:collapse}#fbjs button,#fbjs input,#fbjs optgroup,#fbjs select,#fbjs textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}#fbjs button,#fbjs select{text-transform:none}#fbjs button,#fbjs [type=button],#fbjs [type=reset],#fbjs [type=submit]{-webkit-appearance:button;background-color:transparent;background-image:none}#fbjs :-moz-focusring{outline:auto}#fbjs :-moz-ui-invalid{box-shadow:none}#fbjs progress{vertical-align:baseline}#fbjs ::-webkit-inner-spin-button,#fbjs ::-webkit-outer-spin-button{height:auto}#fbjs [type=search]{-webkit-appearance:textfield;outline-offset:-2px}#fbjs ::-webkit-search-decoration{-webkit-appearance:none}#fbjs ::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}#fbjs summary{display:list-item}#fbjs blockquote,#fbjs dl,#fbjs dd,#fbjs h1,#fbjs h2,#fbjs h3,#fbjs h4,#fbjs h5,#fbjs h6,#fbjs hr,#fbjs figure,#fbjs p,#fbjs pre{margin:0}#fbjs fieldset{margin:0;padding:0}#fbjs legend{padding:0}#fbjs ol,#fbjs ul,#fbjs menu{list-style:none;margin:0;padding:0}#fbjs textarea{resize:vertical}#fbjs input::-moz-placeholder,#fbjs textarea::-moz-placeholder{opacity:1;color:#9ca3af}#fbjs input::placeholder,#fbjs textarea::placeholder{opacity:1;color:#9ca3af}#fbjs button,#fbjs [role=button]{cursor:pointer}#fbjs :disabled{cursor:default}#fbjs img,#fbjs svg,#fbjs video,#fbjs canvas,#fbjs audio,#fbjs iframe,#fbjs embed,#fbjs object{display:block;vertical-align:middle}#fbjs img,#fbjs video{max-width:100%;height:auto}#fbjs [hidden]{display:none}';
const calendarCss = ".react-calendar{width:350px;max-width:100%;background:#fff;border:1px solid #a0a096;font-family:Arial,Helvetica,sans-serif;line-height:1.125em}.react-calendar--doubleView{width:700px}.react-calendar--doubleView .react-calendar__viewContainer{display:flex;margin:-.5em}.react-calendar--doubleView .react-calendar__viewContainer>*{width:50%;margin:.5em}.react-calendar,.react-calendar *,.react-calendar *:before,.react-calendar *:after{box-sizing:border-box}.react-calendar button{margin:0;border:0;outline:none}.react-calendar button:enabled:hover{cursor:pointer}.react-calendar__navigation{display:flex;height:44px;margin-bottom:1em}.react-calendar__navigation button{min-width:44px;background:none}.react-calendar__navigation button:disabled{background-color:#f0f0f0}.react-calendar__navigation button:enabled:hover,.react-calendar__navigation button:enabled:focus{background-color:#e6e6e6}.react-calendar__month-view__weekdays{text-align:center;text-transform:uppercase;font:inherit;font-size:.75em;font-weight:700}.react-calendar__month-view__weekdays__weekday{padding:.5em}.react-calendar__month-view__weekNumbers .react-calendar__tile{display:flex;align-items:center;justify-content:center;font:inherit;font-size:.75em;font-weight:700}.react-calendar__month-view__days__day--weekend{color:#d10000}.react-calendar__month-view__days__day--neighboringMonth,.react-calendar__decade-view__years__year--neighboringDecade,.react-calendar__century-view__decades__decade--neighboringCentury{color:#757575}.react-calendar__year-view .react-calendar__tile,.react-calendar__decade-view .react-calendar__tile,.react-calendar__century-view .react-calendar__tile{padding:2em .5em}.react-calendar__tile{max-width:100%;padding:10px 6.6667px;background:none;text-align:center;line-height:16px;font:inherit;font-size:.833em}.react-calendar__tile:disabled{background-color:#f0f0f0;color:#ababab}.react-calendar__month-view__days__day--neighboringMonth:disabled,.react-calendar__decade-view__years__year--neighboringDecade:disabled,.react-calendar__century-view__decades__decade--neighboringCentury:disabled{color:#cdcdcd}.react-calendar__tile:enabled:hover,.react-calendar__tile:enabled:focus{background-color:#e6e6e6}.react-calendar__tile--now{background:#ffff76}.react-calendar__tile--now:enabled:hover,.react-calendar__tile--now:enabled:focus{background:#ffffa9}.react-calendar__tile--hasActive{background:#76baff}.react-calendar__tile--hasActive:enabled:hover,.react-calendar__tile--hasActive:enabled:focus{background:#a9d4ff}.react-calendar__tile--active{background:#006edc;color:#fff}.react-calendar__tile--active:enabled:hover,.react-calendar__tile--active:enabled:focus{background:#1087ff}.react-calendar--selectRange .react-calendar__tile--hover{background-color:#e6e6e6}";
const datePickerCss = ".react-date-picker{display:inline-flex;position:relative}.react-date-picker,.react-date-picker *,.react-date-picker *:before,.react-date-picker *:after{box-sizing:border-box}.react-date-picker--disabled{background-color:#f0f0f0;color:#6d6d6d}.react-date-picker__wrapper{display:flex;flex-grow:1;flex-shrink:0;border:thin solid gray}.react-date-picker__inputGroup{min-width:calc((4px * 3) + .54em * 8 + .217em * 2);flex-grow:1;padding:0 2px;box-sizing:content-box}.react-date-picker__inputGroup__divider{padding:1px 0;white-space:pre}.react-date-picker__inputGroup__divider,.react-date-picker__inputGroup__leadingZero{display:inline-block;font:inherit}.react-date-picker__inputGroup__input{min-width:.54em;height:100%;position:relative;padding:0 1px;border:0;background:none;color:currentColor;font:inherit;box-sizing:content-box;-webkit-appearance:textfield;-moz-appearance:textfield;appearance:textfield}.react-date-picker__inputGroup__input::-webkit-outer-spin-button,.react-date-picker__inputGroup__input::-webkit-inner-spin-button{-webkit-appearance:none;-moz-appearance:none;appearance:none;margin:0}.react-date-picker__inputGroup__input:invalid{background:#ff00001a}.react-date-picker__inputGroup__input--hasLeadingZero{margin-left:-.54em;padding-left:calc(1px + .54em)}.react-date-picker__button{border:0;background:transparent;padding:4px 6px}.react-date-picker__button:enabled{cursor:pointer}.react-date-picker__button:enabled:hover .react-date-picker__button__icon,.react-date-picker__button:enabled:focus .react-date-picker__button__icon{stroke:#0078d7}.react-date-picker__button:disabled .react-date-picker__button__icon{stroke:#6d6d6d}.react-date-picker__button svg{display:inherit}.react-date-picker__calendar{width:350px;max-width:100vw;z-index:1}.react-date-picker__calendar--closed{display:none}.react-date-picker__calendar .react-calendar{border-width:thin}";
const hexToRGBA = (hex, opacity) => {
  if (!hex || hex === "") return void 0;
  let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, (_2, r22, g22, b22) => r22 + r22 + g22 + g22 + b22 + b22);
  let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "";
  let r2 = parseInt(result[1], 16);
  let g2 = parseInt(result[2], 16);
  let b2 = parseInt(result[3], 16);
  return `rgba(${r2}, ${g2}, ${b2}, ${opacity})`;
};
const mixColor = (hexColor, mixWithHex, weight) => {
  var _a2, _b;
  const color1 = hexToRGBA(hexColor, 1) || "";
  const color2 = hexToRGBA(mixWithHex, 1) || "";
  const [r1, g1, b1] = ((_a2 = color1.match(/\d+/g)) == null ? void 0 : _a2.map(Number)) || [0, 0, 0];
  const [r2, g2, b2] = ((_b = color2.match(/\d+/g)) == null ? void 0 : _b.map(Number)) || [0, 0, 0];
  const r3 = Math.round(r1 * (1 - weight) + r2 * weight);
  const g3 = Math.round(g1 * (1 - weight) + g2 * weight);
  const b3 = Math.round(b1 * (1 - weight) + b2 * weight);
  return `#${((1 << 24) + (r3 << 16) + (g3 << 8) + b3).toString(16).slice(1)}`;
};
const isLight = (color) => {
  let r2, g2, b2;
  if (color.length === 4) {
    r2 = parseInt(color[1] + color[1], 16);
    g2 = parseInt(color[2] + color[2], 16);
    b2 = parseInt(color[3] + color[3], 16);
  } else if (color.length === 7) {
    r2 = parseInt(color[1] + color[2], 16);
    g2 = parseInt(color[3] + color[4], 16);
    b2 = parseInt(color[5] + color[6], 16);
  }
  if (r2 === void 0 || g2 === void 0 || b2 === void 0) {
    throw new Error("Invalid color");
  }
  return r2 * 0.299 + g2 * 0.587 + b2 * 0.114 > 128;
};
const editorCss = ".fb-editor-text-bold{font-weight:700!important}.fb-editor-text-italic{font-style:italic!important}.fb-editor-link{text-decoration:underline!important}.editor-tokenFunction{color:#dd4a68!important}.fb-editor-paragraph{margin:0!important;position:relative!important}.fb-editor-paragraph:last-child{margin-bottom:0!important}.fb-editor-heading-h1{font-size:25px!important;font-weight:400!important;margin-bottom:20px!important;font-weight:700!important}.fb-editor-heading-h2{font-size:20px!important;font-weight:700!important;margin-bottom:20px!important}.fb-editor-list-ul,.fb-editor-list-ol{margin-bottom:12px!important}.fb-editor-listitem{margin:0 32px!important}.fb-editor-nested-listitem{list-style-type:none!important}.fb-editor-rtl{text-align:right!important}.fb-editor-ltr{text-align:left!important}";
const datePickerCustomCss = ".dp-input-root{width:100%}.dp-input-root [class$=wrapper]{height:160px;display:flex;background:#f8fafc;background:var(--fb-survey-background-color);flex-direction:row-reverse;gap:8px;justify-content:center;align-items:center;border-radius:8px;border:1px solid rgb(203 213 225)!important;padding:8px 24px;margin-bottom:8px}.dp-input-root [class$=inputGroup]{flex:none;font-size:16px}.wrapper-hide .react-date-picker__inputGroup{display:none}.dp-input-root .react-date-picker__inputGroup__input{background:#f1f5f9!important;border-radius:2px}.dp-input-root .react-date-picker__inputGroup__input:invalid{background:#fecaca!important;border-radius:2px}.hide-invalid .react-date-picker__inputGroup__input:invalid{background:#f1f5f9!important}.wrapper-hide .react-date-picker__wrapper{display:none}.react-date-picker__calendar--open{position:absolute!important;top:0!important;width:100%!important}.calendar-root{position:absolute!important;top:0!important;background:var(--fb-survey-background-color)!important;width:100%!important}.calendar-root [class$=navigation]{height:36px;margin-bottom:0}.calendar-root [class$=navigation] button{border-radius:8px}.calendar-root [class$=navigation] button:hover{background:#e2e8f0!important}.calendar-root [class$=navigation] button:focus{background:#e2e8f0!important;box-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color)}.calendar-root [class$=navigation] [class$=navigation__label]{font-size:14px;font-weight:500;white-space:nowrap}.react-calendar__month-view__weekdays__weekday{color:#64748b;font-weight:400;text-transform:capitalize}.react-calendar__month-view__weekdays__weekday>abbr{text-decoration:none}.react-calendar{width:100%;line-height:2em}.react-calendar__tile--active{background:var(--fb-brand-color)!important;border-radius:6px}.react-calendar button:hover{background:#e2e8f0!important;border-radius:10%}.react-calendar button:focus{outline:2px solid rgb(226 232 240)!important;border-radius:6px}";
const addStylesToDom = () => {
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = preflight + global$1 + editorCss + datePickerCss + calendarCss + datePickerCustomCss;
    document.head.appendChild(styleElement);
  }
};
const addCustomThemeToDom = ({ styling }) => {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
  let styleElement = document.getElementById("formbricks__css__custom");
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "formbricks__css__custom";
    document.head.appendChild(styleElement);
  }
  let cssVariables = ":root {\n";
  const appendCssVariable = (variableName, value) => {
    if (value !== void 0) {
      cssVariables += `--fb-${variableName}: ${value};
`;
    }
  };
  const roundness = styling.roundness ?? 8;
  appendCssVariable("brand-color", (_a2 = styling.brandColor) == null ? void 0 : _a2.light);
  appendCssVariable("focus-color", (_b = styling.brandColor) == null ? void 0 : _b.light);
  if (!!((_c = styling.brandColor) == null ? void 0 : _c.light)) {
    appendCssVariable("brand-text-color", isLight((_d = styling.brandColor) == null ? void 0 : _d.light) ? "black" : "white");
  } else {
    appendCssVariable("brand-text-color", "#ffffff");
  }
  if ((_e = styling.cardShadowColor) == null ? void 0 : _e.light) {
    appendCssVariable("survey-shadow-color", mixColor(styling.cardShadowColor.light, "#ffffff", 0.4));
  }
  appendCssVariable("heading-color", (_f = styling.questionColor) == null ? void 0 : _f.light);
  appendCssVariable("subheading-color", (_g = styling.questionColor) == null ? void 0 : _g.light);
  if ((_h = styling.questionColor) == null ? void 0 : _h.light) {
    appendCssVariable("placeholder-color", mixColor((_i = styling.questionColor) == null ? void 0 : _i.light, "#ffffff", 0.3));
  }
  appendCssVariable("border-color", (_j = styling.inputBorderColor) == null ? void 0 : _j.light);
  if ((_k = styling.inputBorderColor) == null ? void 0 : _k.light) {
    appendCssVariable("border-color-highlight", mixColor((_l = styling.inputBorderColor) == null ? void 0 : _l.light, "#000000", 0.1));
  }
  appendCssVariable("survey-background-color", (_m = styling.cardBackgroundColor) == null ? void 0 : _m.light);
  appendCssVariable("survey-border-color", (_n = styling.cardBorderColor) == null ? void 0 : _n.light);
  appendCssVariable("border-radius", `${roundness}px`);
  appendCssVariable("input-background-color", (_o = styling.inputColor) == null ? void 0 : _o.light);
  if ((_p = styling.questionColor) == null ? void 0 : _p.light) {
    let signatureColor = "";
    let brandingColor = "";
    if (isLight((_q = styling.questionColor) == null ? void 0 : _q.light)) {
      signatureColor = mixColor((_r = styling.questionColor) == null ? void 0 : _r.light, "#000000", 0.2);
      brandingColor = mixColor((_s = styling.questionColor) == null ? void 0 : _s.light, "#000000", 0.3);
    } else {
      signatureColor = mixColor((_t = styling.questionColor) == null ? void 0 : _t.light, "#ffffff", 0.2);
      brandingColor = mixColor((_u = styling.questionColor) == null ? void 0 : _u.light, "#ffffff", 0.3);
    }
    appendCssVariable("signature-text-color", signatureColor);
    appendCssVariable("branding-text-color", brandingColor);
  }
  if (!!((_v = styling.inputColor) == null ? void 0 : _v.light)) {
    if (styling.inputColor.light === "#fff" || styling.inputColor.light === "#ffffff" || styling.inputColor.light === "white") {
      appendCssVariable("input-background-color-selected", "var(--slate-50)");
    } else {
      appendCssVariable(
        "input-background-color-selected",
        mixColor((_w = styling.inputColor) == null ? void 0 : _w.light, "#000000", 0.025)
      );
    }
  }
  if ((_x = styling.brandColor) == null ? void 0 : _x.light) {
    const brandColor = styling.brandColor.light;
    const accentColor = mixColor(brandColor, "#ffffff", 0.8);
    const accentColorSelected = mixColor(brandColor, "#ffffff", 0.7);
    appendCssVariable("accent-background-color", accentColor);
    appendCssVariable("accent-background-color-selected", accentColorSelected);
  }
  cssVariables += "}";
  styleElement.innerHTML = cssVariables;
};
const renderSurveyInline = (props) => {
  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });
  const element = document.getElementById(props.containerId);
  if (!element) {
    throw new Error(`renderSurvey: Element with id ${props.containerId} not found.`);
  }
  B$2(_$1(SurveyInline, props), element);
};
const renderSurveyModal = (props) => {
  addStylesToDom();
  addCustomThemeToDom({ styling: props.styling });
  const element = document.createElement("div");
  element.id = "formbricks-modal-container";
  document.body.appendChild(element);
  B$2(_$1(SurveyModal, props), element);
};
if (typeof window !== "undefined") {
  window.formbricksSurveys = {
    renderSurveyInline,
    renderSurveyModal
  };
}
var purify = { exports: {} };
/*! @license DOMPurify 3.1.7 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.1.7/LICENSE */
var hasRequiredPurify;
function requirePurify() {
  if (hasRequiredPurify) return purify.exports;
  hasRequiredPurify = 1;
  (function(module, exports) {
    (function(global2, factory) {
      module.exports = factory();
    })(commonjsGlobal, function() {
      const {
        entries,
        setPrototypeOf,
        isFrozen,
        getPrototypeOf,
        getOwnPropertyDescriptor
      } = Object;
      let {
        freeze,
        seal,
        create
      } = Object;
      let {
        apply,
        construct
      } = typeof Reflect !== "undefined" && Reflect;
      if (!freeze) {
        freeze = function freeze2(x2) {
          return x2;
        };
      }
      if (!seal) {
        seal = function seal2(x2) {
          return x2;
        };
      }
      if (!apply) {
        apply = function apply2(fun, thisValue, args) {
          return fun.apply(thisValue, args);
        };
      }
      if (!construct) {
        construct = function construct2(Func, args) {
          return new Func(...args);
        };
      }
      const arrayForEach = unapply(Array.prototype.forEach);
      const arrayPop = unapply(Array.prototype.pop);
      const arrayPush = unapply(Array.prototype.push);
      const stringToLowerCase = unapply(String.prototype.toLowerCase);
      const stringToString = unapply(String.prototype.toString);
      const stringMatch = unapply(String.prototype.match);
      const stringReplace = unapply(String.prototype.replace);
      const stringIndexOf = unapply(String.prototype.indexOf);
      const stringTrim = unapply(String.prototype.trim);
      const objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
      const regExpTest = unapply(RegExp.prototype.test);
      const typeErrorCreate = unconstruct(TypeError);
      function unapply(func) {
        return function(thisArg) {
          for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
            args[_key - 1] = arguments[_key];
          }
          return apply(func, thisArg, args);
        };
      }
      function unconstruct(func) {
        return function() {
          for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            args[_key2] = arguments[_key2];
          }
          return construct(func, args);
        };
      }
      function addToSet(set, array) {
        let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
        if (setPrototypeOf) {
          setPrototypeOf(set, null);
        }
        let l2 = array.length;
        while (l2--) {
          let element = array[l2];
          if (typeof element === "string") {
            const lcElement = transformCaseFunc(element);
            if (lcElement !== element) {
              if (!isFrozen(array)) {
                array[l2] = lcElement;
              }
              element = lcElement;
            }
          }
          set[element] = true;
        }
        return set;
      }
      function cleanArray(array) {
        for (let index = 0; index < array.length; index++) {
          const isPropertyExist = objectHasOwnProperty(array, index);
          if (!isPropertyExist) {
            array[index] = null;
          }
        }
        return array;
      }
      function clone(object) {
        const newObject = create(null);
        for (const [property, value] of entries(object)) {
          const isPropertyExist = objectHasOwnProperty(object, property);
          if (isPropertyExist) {
            if (Array.isArray(value)) {
              newObject[property] = cleanArray(value);
            } else if (value && typeof value === "object" && value.constructor === Object) {
              newObject[property] = clone(value);
            } else {
              newObject[property] = value;
            }
          }
        }
        return newObject;
      }
      function lookupGetter(object, prop) {
        while (object !== null) {
          const desc = getOwnPropertyDescriptor(object, prop);
          if (desc) {
            if (desc.get) {
              return unapply(desc.get);
            }
            if (typeof desc.value === "function") {
              return unapply(desc.value);
            }
          }
          object = getPrototypeOf(object);
        }
        function fallbackValue() {
          return null;
        }
        return fallbackValue;
      }
      const html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "section", "select", "shadow", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
      const svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
      const svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
      const svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
      const mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
      const mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
      const text = freeze(["#text"]);
      const html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns", "slot"]);
      const svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
      const mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnsalign", "columnlines", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lspace", "lquote", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
      const xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
      const MUSTACHE_EXPR = seal(/\{\{[\w\W]*|[\w\W]*\}\}/gm);
      const ERB_EXPR = seal(/<%[\w\W]*|[\w\W]*%>/gm);
      const TMPLIT_EXPR = seal(/\${[\w\W]*}/gm);
      const DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]/);
      const ARIA_ATTR = seal(/^aria-[\-\w]+$/);
      const IS_ALLOWED_URI = seal(
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
        // eslint-disable-line no-useless-escape
      );
      const IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
      const ATTR_WHITESPACE = seal(
        /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
        // eslint-disable-line no-control-regex
      );
      const DOCTYPE_NAME = seal(/^html$/i);
      const CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
      var EXPRESSIONS = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        MUSTACHE_EXPR,
        ERB_EXPR,
        TMPLIT_EXPR,
        DATA_ATTR,
        ARIA_ATTR,
        IS_ALLOWED_URI,
        IS_SCRIPT_OR_DATA,
        ATTR_WHITESPACE,
        DOCTYPE_NAME,
        CUSTOM_ELEMENT
      });
      const NODE_TYPE = {
        element: 1,
        attribute: 2,
        text: 3,
        cdataSection: 4,
        entityReference: 5,
        // Deprecated
        entityNode: 6,
        // Deprecated
        progressingInstruction: 7,
        comment: 8,
        document: 9,
        documentType: 10,
        documentFragment: 11,
        notation: 12
        // Deprecated
      };
      const getGlobal = function getGlobal2() {
        return typeof window === "undefined" ? null : window;
      };
      const _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
        if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
          return null;
        }
        let suffix = null;
        const ATTR_NAME = "data-tt-policy-suffix";
        if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
          suffix = purifyHostElement.getAttribute(ATTR_NAME);
        }
        const policyName = "dompurify" + (suffix ? "#" + suffix : "");
        try {
          return trustedTypes.createPolicy(policyName, {
            createHTML(html2) {
              return html2;
            },
            createScriptURL(scriptUrl) {
              return scriptUrl;
            }
          });
        } catch (_2) {
          console.warn("TrustedTypes policy " + policyName + " could not be created.");
          return null;
        }
      };
      function createDOMPurify() {
        let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
        const DOMPurify = (root2) => createDOMPurify(root2);
        DOMPurify.version = "3.1.7";
        DOMPurify.removed = [];
        if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document) {
          DOMPurify.isSupported = false;
          return DOMPurify;
        }
        let {
          document: document2
        } = window2;
        const originalDocument = document2;
        const currentScript = originalDocument.currentScript;
        const {
          DocumentFragment,
          HTMLTemplateElement,
          Node,
          Element: Element2,
          NodeFilter,
          NamedNodeMap = window2.NamedNodeMap || window2.MozNamedAttrMap,
          HTMLFormElement,
          DOMParser,
          trustedTypes
        } = window2;
        const ElementPrototype = Element2.prototype;
        const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
        const remove2 = lookupGetter(ElementPrototype, "remove");
        const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
        const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
        const getParentNode = lookupGetter(ElementPrototype, "parentNode");
        if (typeof HTMLTemplateElement === "function") {
          const template = document2.createElement("template");
          if (template.content && template.content.ownerDocument) {
            document2 = template.content.ownerDocument;
          }
        }
        let trustedTypesPolicy;
        let emptyHTML = "";
        const {
          implementation,
          createNodeIterator,
          createDocumentFragment,
          getElementsByTagName
        } = document2;
        const {
          importNode
        } = originalDocument;
        let hooks = {};
        DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
        const {
          MUSTACHE_EXPR: MUSTACHE_EXPR2,
          ERB_EXPR: ERB_EXPR2,
          TMPLIT_EXPR: TMPLIT_EXPR2,
          DATA_ATTR: DATA_ATTR2,
          ARIA_ATTR: ARIA_ATTR2,
          IS_SCRIPT_OR_DATA: IS_SCRIPT_OR_DATA2,
          ATTR_WHITESPACE: ATTR_WHITESPACE2,
          CUSTOM_ELEMENT: CUSTOM_ELEMENT2
        } = EXPRESSIONS;
        let {
          IS_ALLOWED_URI: IS_ALLOWED_URI$1
        } = EXPRESSIONS;
        let ALLOWED_TAGS = null;
        const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
        let ALLOWED_ATTR = null;
        const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
        let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
          tagNameCheck: {
            writable: true,
            configurable: false,
            enumerable: true,
            value: null
          },
          attributeNameCheck: {
            writable: true,
            configurable: false,
            enumerable: true,
            value: null
          },
          allowCustomizedBuiltInElements: {
            writable: true,
            configurable: false,
            enumerable: true,
            value: false
          }
        }));
        let FORBID_TAGS = null;
        let FORBID_ATTR = null;
        let ALLOW_ARIA_ATTR = true;
        let ALLOW_DATA_ATTR = true;
        let ALLOW_UNKNOWN_PROTOCOLS = false;
        let ALLOW_SELF_CLOSE_IN_ATTR = true;
        let SAFE_FOR_TEMPLATES = false;
        let SAFE_FOR_XML = true;
        let WHOLE_DOCUMENT = false;
        let SET_CONFIG = false;
        let FORCE_BODY = false;
        let RETURN_DOM = false;
        let RETURN_DOM_FRAGMENT = false;
        let RETURN_TRUSTED_TYPE = false;
        let SANITIZE_DOM = true;
        let SANITIZE_NAMED_PROPS = false;
        const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
        let KEEP_CONTENT = true;
        let IN_PLACE = false;
        let USE_PROFILES = {};
        let FORBID_CONTENTS = null;
        const DEFAULT_FORBID_CONTENTS = addToSet({}, ["annotation-xml", "audio", "colgroup", "desc", "foreignobject", "head", "iframe", "math", "mi", "mn", "mo", "ms", "mtext", "noembed", "noframes", "noscript", "plaintext", "script", "style", "svg", "template", "thead", "title", "video", "xmp"]);
        let DATA_URI_TAGS = null;
        const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
        let URI_SAFE_ATTRIBUTES = null;
        const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
        const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
        const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
        const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
        let NAMESPACE = HTML_NAMESPACE;
        let IS_EMPTY_INPUT = false;
        let ALLOWED_NAMESPACES = null;
        const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
        let PARSER_MEDIA_TYPE = null;
        const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
        const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
        let transformCaseFunc = null;
        let CONFIG = null;
        const formElement = document2.createElement("form");
        const isRegexOrFunction = function isRegexOrFunction2(testValue) {
          return testValue instanceof RegExp || testValue instanceof Function;
        };
        const _parseConfig = function _parseConfig2() {
          let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
          if (CONFIG && CONFIG === cfg) {
            return;
          }
          if (!cfg || typeof cfg !== "object") {
            cfg = {};
          }
          cfg = clone(cfg);
          PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
          SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
          transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
          ALLOWED_TAGS = objectHasOwnProperty(cfg, "ALLOWED_TAGS") ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
          ALLOWED_ATTR = objectHasOwnProperty(cfg, "ALLOWED_ATTR") ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
          ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
          URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") ? addToSet(
            clone(DEFAULT_URI_SAFE_ATTRIBUTES),
            // eslint-disable-line indent
            cfg.ADD_URI_SAFE_ATTR,
            // eslint-disable-line indent
            transformCaseFunc
            // eslint-disable-line indent
          ) : DEFAULT_URI_SAFE_ATTRIBUTES;
          DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") ? addToSet(
            clone(DEFAULT_DATA_URI_TAGS),
            // eslint-disable-line indent
            cfg.ADD_DATA_URI_TAGS,
            // eslint-disable-line indent
            transformCaseFunc
            // eslint-disable-line indent
          ) : DEFAULT_DATA_URI_TAGS;
          FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
          FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : {};
          FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : {};
          USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES : false;
          ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
          ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
          ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
          ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
          SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
          SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
          WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
          RETURN_DOM = cfg.RETURN_DOM || false;
          RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
          RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
          FORCE_BODY = cfg.FORCE_BODY || false;
          SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
          SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
          KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
          IN_PLACE = cfg.IN_PLACE || false;
          IS_ALLOWED_URI$1 = cfg.ALLOWED_URI_REGEXP || IS_ALLOWED_URI;
          NAMESPACE = cfg.NAMESPACE || HTML_NAMESPACE;
          CUSTOM_ELEMENT_HANDLING = cfg.CUSTOM_ELEMENT_HANDLING || {};
          if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck)) {
            CUSTOM_ELEMENT_HANDLING.tagNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.tagNameCheck;
          }
          if (cfg.CUSTOM_ELEMENT_HANDLING && isRegexOrFunction(cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck)) {
            CUSTOM_ELEMENT_HANDLING.attributeNameCheck = cfg.CUSTOM_ELEMENT_HANDLING.attributeNameCheck;
          }
          if (cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements === "boolean") {
            CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = cfg.CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements;
          }
          if (SAFE_FOR_TEMPLATES) {
            ALLOW_DATA_ATTR = false;
          }
          if (RETURN_DOM_FRAGMENT) {
            RETURN_DOM = true;
          }
          if (USE_PROFILES) {
            ALLOWED_TAGS = addToSet({}, text);
            ALLOWED_ATTR = [];
            if (USE_PROFILES.html === true) {
              addToSet(ALLOWED_TAGS, html$1);
              addToSet(ALLOWED_ATTR, html);
            }
            if (USE_PROFILES.svg === true) {
              addToSet(ALLOWED_TAGS, svg$1);
              addToSet(ALLOWED_ATTR, svg);
              addToSet(ALLOWED_ATTR, xml);
            }
            if (USE_PROFILES.svgFilters === true) {
              addToSet(ALLOWED_TAGS, svgFilters);
              addToSet(ALLOWED_ATTR, svg);
              addToSet(ALLOWED_ATTR, xml);
            }
            if (USE_PROFILES.mathMl === true) {
              addToSet(ALLOWED_TAGS, mathMl$1);
              addToSet(ALLOWED_ATTR, mathMl);
              addToSet(ALLOWED_ATTR, xml);
            }
          }
          if (cfg.ADD_TAGS) {
            if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
              ALLOWED_TAGS = clone(ALLOWED_TAGS);
            }
            addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
          }
          if (cfg.ADD_ATTR) {
            if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
              ALLOWED_ATTR = clone(ALLOWED_ATTR);
            }
            addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
          }
          if (cfg.ADD_URI_SAFE_ATTR) {
            addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
          }
          if (cfg.FORBID_CONTENTS) {
            if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
              FORBID_CONTENTS = clone(FORBID_CONTENTS);
            }
            addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
          }
          if (KEEP_CONTENT) {
            ALLOWED_TAGS["#text"] = true;
          }
          if (WHOLE_DOCUMENT) {
            addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
          }
          if (ALLOWED_TAGS.table) {
            addToSet(ALLOWED_TAGS, ["tbody"]);
            delete FORBID_TAGS.tbody;
          }
          if (cfg.TRUSTED_TYPES_POLICY) {
            if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
              throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
            }
            if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
              throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
            }
            trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
            emptyHTML = trustedTypesPolicy.createHTML("");
          } else {
            if (trustedTypesPolicy === void 0) {
              trustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
            }
            if (trustedTypesPolicy !== null && typeof emptyHTML === "string") {
              emptyHTML = trustedTypesPolicy.createHTML("");
            }
          }
          if (freeze) {
            freeze(cfg);
          }
          CONFIG = cfg;
        };
        const MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
        const HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
        const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
        const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
        const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
        const _checkValidNamespace = function _checkValidNamespace2(element) {
          let parent = getParentNode(element);
          if (!parent || !parent.tagName) {
            parent = {
              namespaceURI: NAMESPACE,
              tagName: "template"
            };
          }
          const tagName = stringToLowerCase(element.tagName);
          const parentTagName = stringToLowerCase(parent.tagName);
          if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
            return false;
          }
          if (element.namespaceURI === SVG_NAMESPACE) {
            if (parent.namespaceURI === HTML_NAMESPACE) {
              return tagName === "svg";
            }
            if (parent.namespaceURI === MATHML_NAMESPACE) {
              return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
            }
            return Boolean(ALL_SVG_TAGS[tagName]);
          }
          if (element.namespaceURI === MATHML_NAMESPACE) {
            if (parent.namespaceURI === HTML_NAMESPACE) {
              return tagName === "math";
            }
            if (parent.namespaceURI === SVG_NAMESPACE) {
              return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
            }
            return Boolean(ALL_MATHML_TAGS[tagName]);
          }
          if (element.namespaceURI === HTML_NAMESPACE) {
            if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
              return false;
            }
            if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
              return false;
            }
            return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
          }
          if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
            return true;
          }
          return false;
        };
        const _forceRemove = function _forceRemove2(node) {
          arrayPush(DOMPurify.removed, {
            element: node
          });
          try {
            getParentNode(node).removeChild(node);
          } catch (_2) {
            remove2(node);
          }
        };
        const _removeAttribute = function _removeAttribute2(name, node) {
          try {
            arrayPush(DOMPurify.removed, {
              attribute: node.getAttributeNode(name),
              from: node
            });
          } catch (_2) {
            arrayPush(DOMPurify.removed, {
              attribute: null,
              from: node
            });
          }
          node.removeAttribute(name);
          if (name === "is" && !ALLOWED_ATTR[name]) {
            if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
              try {
                _forceRemove(node);
              } catch (_2) {
              }
            } else {
              try {
                node.setAttribute(name, "");
              } catch (_2) {
              }
            }
          }
        };
        const _initDocument = function _initDocument2(dirty) {
          let doc = null;
          let leadingWhitespace = null;
          if (FORCE_BODY) {
            dirty = "<remove></remove>" + dirty;
          } else {
            const matches = stringMatch(dirty, /^[\r\n\t ]+/);
            leadingWhitespace = matches && matches[0];
          }
          if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
            dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
          }
          const dirtyPayload = trustedTypesPolicy ? trustedTypesPolicy.createHTML(dirty) : dirty;
          if (NAMESPACE === HTML_NAMESPACE) {
            try {
              doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
            } catch (_2) {
            }
          }
          if (!doc || !doc.documentElement) {
            doc = implementation.createDocument(NAMESPACE, "template", null);
            try {
              doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
            } catch (_2) {
            }
          }
          const body = doc.body || doc.documentElement;
          if (dirty && leadingWhitespace) {
            body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
          }
          if (NAMESPACE === HTML_NAMESPACE) {
            return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
          }
          return WHOLE_DOCUMENT ? doc.documentElement : body;
        };
        const _createNodeIterator = function _createNodeIterator2(root2) {
          return createNodeIterator.call(
            root2.ownerDocument || root2,
            root2,
            // eslint-disable-next-line no-bitwise
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
            null
          );
        };
        const _isClobbered = function _isClobbered2(elm) {
          return elm instanceof HTMLFormElement && (typeof elm.nodeName !== "string" || typeof elm.textContent !== "string" || typeof elm.removeChild !== "function" || !(elm.attributes instanceof NamedNodeMap) || typeof elm.removeAttribute !== "function" || typeof elm.setAttribute !== "function" || typeof elm.namespaceURI !== "string" || typeof elm.insertBefore !== "function" || typeof elm.hasChildNodes !== "function");
        };
        const _isNode = function _isNode2(object) {
          return typeof Node === "function" && object instanceof Node;
        };
        const _executeHook = function _executeHook2(entryPoint, currentNode, data) {
          if (!hooks[entryPoint]) {
            return;
          }
          arrayForEach(hooks[entryPoint], (hook) => {
            hook.call(DOMPurify, currentNode, data, CONFIG);
          });
        };
        const _sanitizeElements = function _sanitizeElements2(currentNode) {
          let content = null;
          _executeHook("beforeSanitizeElements", currentNode, null);
          if (_isClobbered(currentNode)) {
            _forceRemove(currentNode);
            return true;
          }
          const tagName = transformCaseFunc(currentNode.nodeName);
          _executeHook("uponSanitizeElement", currentNode, {
            tagName,
            allowedTags: ALLOWED_TAGS
          });
          if (currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w]/g, currentNode.innerHTML) && regExpTest(/<[/\w]/g, currentNode.textContent)) {
            _forceRemove(currentNode);
            return true;
          }
          if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
            _forceRemove(currentNode);
            return true;
          }
          if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
            _forceRemove(currentNode);
            return true;
          }
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
              if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
                return false;
              }
              if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
                return false;
              }
            }
            if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
              const parentNode = getParentNode(currentNode) || currentNode.parentNode;
              const childNodes = getChildNodes(currentNode) || currentNode.childNodes;
              if (childNodes && parentNode) {
                const childCount = childNodes.length;
                for (let i2 = childCount - 1; i2 >= 0; --i2) {
                  const childClone = cloneNode(childNodes[i2], true);
                  childClone.__removalCount = (currentNode.__removalCount || 0) + 1;
                  parentNode.insertBefore(childClone, getNextSibling(currentNode));
                }
              }
            }
            _forceRemove(currentNode);
            return true;
          }
          if (currentNode instanceof Element2 && !_checkValidNamespace(currentNode)) {
            _forceRemove(currentNode);
            return true;
          }
          if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
            _forceRemove(currentNode);
            return true;
          }
          if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
            content = currentNode.textContent;
            arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
              content = stringReplace(content, expr, " ");
            });
            if (currentNode.textContent !== content) {
              arrayPush(DOMPurify.removed, {
                element: currentNode.cloneNode()
              });
              currentNode.textContent = content;
            }
          }
          _executeHook("afterSanitizeElements", currentNode, null);
          return false;
        };
        const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
          if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
            return false;
          }
          if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR2, lcName)) ;
          else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR2, lcName)) ;
          else if (!ALLOWED_ATTR[lcName] || FORBID_ATTR[lcName]) {
            if (
              // First condition does a very basic check if a) it's basically a valid custom element tagname AND
              // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
              // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
              _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName)) || // Alternative, second condition checks if it's an `is`-attribute, AND
              // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
              lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
            ) ;
            else {
              return false;
            }
          } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
          else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
          else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
          else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA2, stringReplace(value, ATTR_WHITESPACE2, ""))) ;
          else if (value) {
            return false;
          } else ;
          return true;
        };
        const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
          return tagName !== "annotation-xml" && stringMatch(tagName, CUSTOM_ELEMENT2);
        };
        const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
          _executeHook("beforeSanitizeAttributes", currentNode, null);
          const {
            attributes
          } = currentNode;
          if (!attributes) {
            return;
          }
          const hookEvent = {
            attrName: "",
            attrValue: "",
            keepAttr: true,
            allowedAttributes: ALLOWED_ATTR
          };
          let l2 = attributes.length;
          while (l2--) {
            const attr = attributes[l2];
            const {
              name,
              namespaceURI,
              value: attrValue
            } = attr;
            const lcName = transformCaseFunc(name);
            let value = name === "value" ? attrValue : stringTrim(attrValue);
            hookEvent.attrName = lcName;
            hookEvent.attrValue = value;
            hookEvent.keepAttr = true;
            hookEvent.forceKeepAttr = void 0;
            _executeHook("uponSanitizeAttribute", currentNode, hookEvent);
            value = hookEvent.attrValue;
            if (hookEvent.forceKeepAttr) {
              continue;
            }
            _removeAttribute(name, currentNode);
            if (!hookEvent.keepAttr) {
              continue;
            }
            if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
              _removeAttribute(name, currentNode);
              continue;
            }
            if (SAFE_FOR_TEMPLATES) {
              arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
                value = stringReplace(value, expr, " ");
              });
            }
            const lcTag = transformCaseFunc(currentNode.nodeName);
            if (!_isValidAttribute(lcTag, lcName, value)) {
              continue;
            }
            if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name")) {
              _removeAttribute(name, currentNode);
              value = SANITIZE_NAMED_PROPS_PREFIX + value;
            }
            if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|title)/i, value)) {
              _removeAttribute(name, currentNode);
              continue;
            }
            if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
              if (namespaceURI) ;
              else {
                switch (trustedTypes.getAttributeType(lcTag, lcName)) {
                  case "TrustedHTML": {
                    value = trustedTypesPolicy.createHTML(value);
                    break;
                  }
                  case "TrustedScriptURL": {
                    value = trustedTypesPolicy.createScriptURL(value);
                    break;
                  }
                }
              }
            }
            try {
              if (namespaceURI) {
                currentNode.setAttributeNS(namespaceURI, name, value);
              } else {
                currentNode.setAttribute(name, value);
              }
              if (_isClobbered(currentNode)) {
                _forceRemove(currentNode);
              } else {
                arrayPop(DOMPurify.removed);
              }
            } catch (_2) {
            }
          }
          _executeHook("afterSanitizeAttributes", currentNode, null);
        };
        const _sanitizeShadowDOM = function _sanitizeShadowDOM2(fragment) {
          let shadowNode = null;
          const shadowIterator = _createNodeIterator(fragment);
          _executeHook("beforeSanitizeShadowDOM", fragment, null);
          while (shadowNode = shadowIterator.nextNode()) {
            _executeHook("uponSanitizeShadowNode", shadowNode, null);
            if (_sanitizeElements(shadowNode)) {
              continue;
            }
            if (shadowNode.content instanceof DocumentFragment) {
              _sanitizeShadowDOM2(shadowNode.content);
            }
            _sanitizeAttributes(shadowNode);
          }
          _executeHook("afterSanitizeShadowDOM", fragment, null);
        };
        DOMPurify.sanitize = function(dirty) {
          let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
          let body = null;
          let importedNode = null;
          let currentNode = null;
          let returnNode = null;
          IS_EMPTY_INPUT = !dirty;
          if (IS_EMPTY_INPUT) {
            dirty = "<!-->";
          }
          if (typeof dirty !== "string" && !_isNode(dirty)) {
            if (typeof dirty.toString === "function") {
              dirty = dirty.toString();
              if (typeof dirty !== "string") {
                throw typeErrorCreate("dirty is not a string, aborting");
              }
            } else {
              throw typeErrorCreate("toString is not a function");
            }
          }
          if (!DOMPurify.isSupported) {
            return dirty;
          }
          if (!SET_CONFIG) {
            _parseConfig(cfg);
          }
          DOMPurify.removed = [];
          if (typeof dirty === "string") {
            IN_PLACE = false;
          }
          if (IN_PLACE) {
            if (dirty.nodeName) {
              const tagName = transformCaseFunc(dirty.nodeName);
              if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
                throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
              }
            }
          } else if (dirty instanceof Node) {
            body = _initDocument("<!---->");
            importedNode = body.ownerDocument.importNode(dirty, true);
            if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
              body = importedNode;
            } else if (importedNode.nodeName === "HTML") {
              body = importedNode;
            } else {
              body.appendChild(importedNode);
            }
          } else {
            if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
            dirty.indexOf("<") === -1) {
              return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(dirty) : dirty;
            }
            body = _initDocument(dirty);
            if (!body) {
              return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
            }
          }
          if (body && FORCE_BODY) {
            _forceRemove(body.firstChild);
          }
          const nodeIterator = _createNodeIterator(IN_PLACE ? dirty : body);
          while (currentNode = nodeIterator.nextNode()) {
            if (_sanitizeElements(currentNode)) {
              continue;
            }
            if (currentNode.content instanceof DocumentFragment) {
              _sanitizeShadowDOM(currentNode.content);
            }
            _sanitizeAttributes(currentNode);
          }
          if (IN_PLACE) {
            return dirty;
          }
          if (RETURN_DOM) {
            if (RETURN_DOM_FRAGMENT) {
              returnNode = createDocumentFragment.call(body.ownerDocument);
              while (body.firstChild) {
                returnNode.appendChild(body.firstChild);
              }
            } else {
              returnNode = body;
            }
            if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
              returnNode = importNode.call(originalDocument, returnNode, true);
            }
            return returnNode;
          }
          let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
          if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
            serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
          }
          if (SAFE_FOR_TEMPLATES) {
            arrayForEach([MUSTACHE_EXPR2, ERB_EXPR2, TMPLIT_EXPR2], (expr) => {
              serializedHTML = stringReplace(serializedHTML, expr, " ");
            });
          }
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? trustedTypesPolicy.createHTML(serializedHTML) : serializedHTML;
        };
        DOMPurify.setConfig = function() {
          let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
          _parseConfig(cfg);
          SET_CONFIG = true;
        };
        DOMPurify.clearConfig = function() {
          CONFIG = null;
          SET_CONFIG = false;
        };
        DOMPurify.isValidAttribute = function(tag, attr, value) {
          if (!CONFIG) {
            _parseConfig({});
          }
          const lcTag = transformCaseFunc(tag);
          const lcName = transformCaseFunc(attr);
          return _isValidAttribute(lcTag, lcName, value);
        };
        DOMPurify.addHook = function(entryPoint, hookFunction) {
          if (typeof hookFunction !== "function") {
            return;
          }
          hooks[entryPoint] = hooks[entryPoint] || [];
          arrayPush(hooks[entryPoint], hookFunction);
        };
        DOMPurify.removeHook = function(entryPoint) {
          if (hooks[entryPoint]) {
            return arrayPop(hooks[entryPoint]);
          }
        };
        DOMPurify.removeHooks = function(entryPoint) {
          if (hooks[entryPoint]) {
            hooks[entryPoint] = [];
          }
        };
        DOMPurify.removeAllHooks = function() {
          hooks = {};
        };
        return DOMPurify;
      }
      var purify2 = createDOMPurify();
      return purify2;
    });
  })(purify);
  return purify.exports;
}
var browser = window.DOMPurify || (window.DOMPurify = requirePurify().default || requirePurify());
const browser$1 = /* @__PURE__ */ getDefaultExportFromCjs(browser);
const browser$2 = /* @__PURE__ */ _mergeNamespaces({
  __proto__: null,
  default: browser$1
}, [browser]);
export {
  renderSurveyInline,
  renderSurveyModal
};
