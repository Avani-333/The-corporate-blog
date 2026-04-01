# Lighthouse Mobile & Desktop Validation - Quick Reference

**Status**: ✅ Ready to Use  
**Validation Targets**: LCP <2.5s | CLS <0.1 | INP <200ms | Score ≥85  
**Quick Start**: `npm run validate:lighthouse`

---

## Commands at a Glance

```bash
# Core validation
npm run validate:lighthouse              # Full (mobile+desktop) on localhost
npm run validate:lighthouse:mobile       # Mobile only
npm run validate:lighthouse:desktop      # Desktop only
npm run validate:lighthouse:local        # Build + run + validate + analyze
npm run validate:lighthouse:analyze      # Analyze collected reports

# Comprehensive
npm run validate:performance             # Includes Lighthouse + Web Vitals + LoadTest
npm run validate:performance:prod        # Against production (https://thecorporateblog.com)

# Raw Lighthouse CLI
npm run lighthouse -- http://localhost:3000
```

---

## Expected Results

✅ **PASS** = All metrics green:

```
✅ LCP        1850ms     (< 2500ms)
✅ CLS        0.08       (< 0.1)
✅ FCP        1200ms     (< 1800ms)
✅ INP        120ms      (< 200ms)
   Score: 92/100        (≥ 85)
```

❌ **FAIL** = Any metric red:

```
❌ LCP        3200ms     (< 2500ms) FAIL
⚠️ CLS        0.12       (< 0.1)    WARN
✅ INP        120ms      (< 200ms)
```

---

## Metric Definitions

| Metric | Target | Good | Warn | Poor | What It Is |
|--------|--------|------|------|------|-----------|
| **LCP** | <2.5s | <2.5s | <4s | >4s | Largest element visible time |
| **CLS** | <0.1 | <0.1 | <0.25 | >0.25 | Visual stability during load |
| **FCP** | <1.8s | <1.8s | <3s | >3s | First content appears |
| **INP** | <200ms | <200ms | <500ms | >500ms | Response to user interaction |
| **Score** | ≥85 | ≥85 | ≥50 | <50 | Overall performance rating |

---

## Quick Optimization Tips

### High LCP? (>2.5s)
- [ ] Optimize images (compress, WebP, lazy load)
- [ ] Defer non-critical JavaScript
- [ ] Check TTFB (server response time)
- [ ] Review ad script impact

### High CLS? (>0.1)
- [ ] Add explicit dimensions to images
- [ ] Reserve space for ads/dynamic content
- [ ] Avoid inserting content above fold
- [ ] Check font loading (use `font-display: swap`)

### High INP? (>200ms)
- [ ] Break long JavaScript into smaller chunks
- [ ] Use `requestIdleCallback` for non-critical work
- [ ] Check for expensive React re-renders
- [ ] Debounce/throttle event handlers

### Low Score? (<85)
- [ ] Review "Opportunities" section in report
- [ ] Check "Diagnostics" for issues
- [ ] Focus on improving LCP, CLS, INP first

---

## File Locations

```
scripts/
├── lighthouse-validator.ts           ← Main validator
├── analyze-lighthouse-reports.js     ← Trend analysis
└── validate-performance.js           ← Comprehensive validation

lighthouse-reports/                  ← Reports saved here
├── lighthouse--2026-03-21T14-30-45-123Z.json
└── validation-2026-03-21T14-30-50-456Z.json

docs/
└── LIGHTHOUSE_MOBILE_DESKTOP_VALIDATION.md  ← Detailed guide
```

---

## Workflow

```
1. Get baseline
   npm run validate:lighthouse

2. Review results
   npm run validate:lighthouse:analyze

3. Identify failures
   Look for ❌ metrics in output

4. Implement optimizations
   Use tips above, update code

5. Verify improvements
   npm run validate:lighthouse

6. Track progress
   npm run validate:lighthouse:analyze
   Look for 📈 improvements
```

---

## Mobile vs Desktop Issues

**Mobile slower than desktop?** (Common)
- Mobile has 4G throttling + CPU throttling (4x)
- Optimize images for mobile
- Defer heavy JavaScript
- Check ad script impact

**Desktop slower?** (Unusual)
- Indicates server issue (TTFB high)
- Check database queries
- Verify cache working
- Review backend performance

---

## Integration with CI/CD

```bash
# In GitHub Actions, pre-deploy:
npm run validate:lighthouse
npm run validate:performance

# Exit code:
# 0 = all pass (safe to deploy) ✅
# 1 = failures (needs fixes) ❌
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Chrome not found | `npm install -g chromium` or `brew install chromium` |
| Timeout | Server slow? Check `npm run start` works first |
| All mobile slower | Normal! Mobile has 4G + 4x CPU throttle |
| Inconsistent results | Run multiple times, check for background processes |
| Reports not saving | Check `./lighthouse-reports/` directory exists |

---

## Performance Budget Example

Target metrics for production:
```
LCP: 2000ms (strict) / 2500ms (warning)
CLS: 0.08  (strict) / 0.1    (warning)
INP: 150ms (strict) / 200ms  (warning)
Score: 90  (strict) / 85     (warning)
```

Monitor these in `npm run validate:lighthouse:analyze`

---

## See Also

- [LIGHTHOUSE_MOBILE_DESKTOP_VALIDATION.md](./LIGHTHOUSE_MOBILE_DESKTOP_VALIDATION.md) - Detailed guide
- [PERFORMANCE_MONITORING_SETUP.md](./PERFORMANCE_MONITORING_SETUP.md) - Real-time monitoring
- [DATABASE_OPTIMIZATION_QUICK_REFERENCE.md](./DATABASE_OPTIMIZATION_QUICK_REFERENCE.md) - Backend optimization

---

## Summary

✅ Run `npm run validate:lighthouse`  
✅ Check output for ✅ pass / ❌ fail / ⚠️ warn  
✅ Fix failing metrics using optimization tips  
✅ Re-run to verify improvements  
✅ Track with `npm run validate:lighthouse:analyze`

For detailed info, see [LIGHTHOUSE_MOBILE_DESKTOP_VALIDATION.md](./LIGHTHOUSE_MOBILE_DESKTOP_VALIDATION.md)
