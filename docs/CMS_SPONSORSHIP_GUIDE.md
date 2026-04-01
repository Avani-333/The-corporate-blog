# CMS Sponsorship & Affiliate Toggle Guide

Complete guide for editors and admins to manage sponsored posts and affiliate content through the CMS.

## Overview

The sponsorship toggle system provides three levels of control:

1. **Mark Post as Sponsored** - Enable/disable sponsorship status
2. **Enforce Disclosure Banner** - Control visibility of sponsorship disclosure
3. **Highlight Affiliate Links** - Visually distinguish affiliate links

## Editor Dashboard

### Accessing Sponsorship Settings

In the post editor:

1. Open **Dashboard → Posts → Edit**
2. In the right sidebar, click the **Sponsor** tab (📌 icon)
3. Configure sponsorship settings

alternatively:

1. Create new post or edit existing
2. Look for the "Sponsorship" section in the sidebar
3. Use the toggles to configure

### Three Tabs in Editor

| Tab | Icon | Purpose |
|-----|------|---------|
| **Settings** | ⚙️ | Categories, tags, featured image |
| **Sponsor** | 📌 | Affiliate & sponsorship config |
| **Publish** | 🌍 | Status, SEO, URL slug |

---

## Sponsorship Panel Controls

### 1. Mark as Sponsored

**Toggle:** ON/OFF

When enabled:
- ✓ Post is marked as sponsored in database
- ✓ Affiliate tracking becomes available
- ✓ Conditional sections appear below
- ✓ Click tracking via `/api/r/:slug` endpoint

When disabled:
- ✗ All affiliate features are hidden
- ✗ No tracking occurs
- ✗ Post appears as regular content

**When to use:**
- ✅ Product reviews sponsored by brand
- ✅ Affiliate product recommendations
- ✅ Paid partnership content
- ❌ Regular editorial content
- ❌ Staff reviews without compensation

---

### 2. Affiliate Link

**Input Field:** URL (when sponsored)

Enter the target URL that users will visit when they click:
- The sponsor's CTA button
- Affiliate links in the post
- Call-to-action buttons

**Format:**
```
https://example.com/product
https://amazon.com/dp/B123ABC?tag=youraffid
https://partner.com/affiliate?id=123
```

**Redirect Info:**
Shows the tracking endpoint: `/api/r/{slug}`

This endpoint:
- Tracks the click in database
- Adds UTM parameters
- Redirects to the affiliate link
- Records: referrer, IP, device, country, user

**Copy Redirect URL:**
Use the copy button (📋) to copy the full redirect URL for external sharing.

**Warning State:**
If no affiliate link is set but post is marked as sponsored:
- ⚠️ Yellow warning displays
- Users will see an error if they click
- **Action:** Add affiliate link before publishing

---

### 3. Enforce Disclosure Banner

**Toggle:** ON/OFF

When enabled:
- ✓ Sponsorship disclosure banner appears at post top
- ✓ Cannot be hidden by toggle in post content
- ✓ Always visible to readers
- ✓ Transparent about sponsorship

When disabled:
- ○ Banner only shows if manually toggled in post
- ○ More flexible disclosure placement
- ○ Allows conditional banner display

**Banner Content:**
```
📌 Sponsored
[Button] Learn More
```

**FTC Compliance:**
This ensures proper disclosure of paid partnerships as required by FTC guidelines.

**When to enforce:**
- ✅ Paid sponsorships where disclosure is required
- ✅ Affiliate content where relationship must be disclosed
- ❌ Optional sponsor mentions
- ❌ Where disclosure is in article text

---

### 4. Highlight Affiliate Links

**Toggle:** ON/OFF

When enabled:
- ✓ All affiliate links in post display with badge
- ✓ Badge text: "affiliate" or "Sponsored"
- ✓ Visual distinction: `Link [badge]`
- ✓ Transparent to users about affiliate nature

When disabled:
- ✗ Links appear as regular hyperlinks
- ✗ No visual badge indicator
- ✗ Affiliate nature not immediately obvious

**Visual Example:**

```
Enabled:    Check out this product [affiliate]
Disabled:   Check out this product
```

**When to enable:**
- ✅ Transparent affiliate disclosure in post text
- ✅ Multi-link posts where some are affiliate
- ✅ High-value affiliate content

**When to disable:**
- ❌ Subtle sponsorships
- ❌ Where disclosure is mentioned in text separately
- ❌ Native advertising approach

---

## Configuration Summary Card

When sponsored, a blue summary displays:

```
✓ Post is marked as sponsored
✓ Affiliate link: ✓ Set (or ✗ Not set)
✓ Disclosure banner: ✓ Enforced (or ○ Optional)
✓ Link highlighting: ✓ Enabled (or ✗ Disabled)
```

This helps confirm all settings are correct before publishing.

---

## Workflow Examples

### Example 1: Amazon Affiliate Post

**Scenario:** Review of camera equipment with Amazon affiliate links

**Settings:**
```
Marked as Sponsored:      ✓ ON
Affiliate Link:           https://amazon.com/dp/B123ABC?tag=youraffid
Enforce Disclosure:       ✓ ON (FTC compliance)
Highlight Links:          ✓ ON (transparency)
```

**Result:**
- Banner at top: "📌 Sponsored"
- Affiliate links highlighted: `Buy on Amazon [affiliate]`
- Clicks tracked and redirected
- Full disclosure to readers

---

### Example 2: Influencer Collaboration

**Scenario:** Free product send from brand in exchange for review

**Settings:**
```
Marked as Sponsored:      ✓ ON
Affiliate Link:           https://brand.com/product
Enforce Disclosure:       ✓ ON (disclose partnership)
Highlight Links:          ○ OFF (mentioned in text)
```

**Result:**
- Banner shows partnership
- Links aren't badged (mentioned in article)
- Click tracking enabled
- Proper disclosure

---

### Example 3: Monetized Blog Post

**Scenario:** Generic product recommendations with multiple affiliate programs

**Settings:**
```
Marked as Sponsored:      ✓ ON
Affiliate Link:           https://example.com/products (primary)
Enforce Disclosure:       ○ OFF (optional)
Highlight Links:          ✓ ON (multi-link clarity)
```

**Result:**
- Banner available if toggled in content
- All affiliate links have badges
- Flexible disclosure approach
- Clear affiliate indication

---

## Implementing in Post Content

### Using Affiliate Link Component

For posts that use React/TSX components:

```tsx
import { PostAffiliateLink, SponsoredLink } from '@/components/blog/AffiliateHighlight';

export function ReviewPost() {
  return (
    <>
      <h1>Product Review</h1>
      
      <p>
        This highly-rated product is{' '}
        <PostAffiliateLink 
          href="https://example.com/product"
          postSlug="my-product-review"
        >
          available here
        </PostAffiliateLink>
        .
      </p>
    </>
  );
}
```

### For MDX/Markdown Posts

Use inline HTML:

```jsx
Check price on [Amazon](https://api/r/my-post) →
```

Or use the component in MDX:

```jsx
<PostAffiliateLink 
  href="https://amazon.com/dp/B123"
  postSlug="my-post"
>
  Click here
</PostAffiliateLink>
```

---

## Analytics & Monitoring

### Viewing Affiliate Stats

After marking post as sponsored:

1. Click **View Stats** button in Sponsorship panel
2. See metrics:
   - **Total Clicks** - All-time clicks
   - **Unique Visitors** - Deduplicated by IP
   - **Last 7 Days** - Recent activity
   - **Avg per Day** - Performance metric
   
3. Breakdown tables:
   - **By Device** - mobile, desktop, tablet
   - **Top Countries** - Geographic distribution

### Admin Dashboard

Full analytics at `/dashboard/admin/affiliate`:

- All sponsored posts overview
- Click trends
- Revenue projections (if configured)
- Individual post performance

---

## Publishing Checklist

Before publishing sponsored content:

- [ ] **Sponsored toggle** is ON
- [ ] **Affiliate link** is set and valid URL
- [ ] **Disclosure banner** is configured correctly
- [ ] **Link highlighting** matches intent
- [ ] FTC compliance met (disclosure visible)
- [ ] Post excerpt mentions sponsorship
- [ ] SEO title reflects nature of content
- [ ] All affiliate links tested and working

---

## SEO & Content Tips

### In SEO Title
```
✓ Good:   "Best Wireless Earbuds [Affiliate Roundup] 2024"
✗ Poor:   "Best Wireless Earbuds 2024"
```

### In Excerpt
```
✓ Good:   "Our top picks for wireless earbuds - includes affiliate links"
✗ Poor:   "Our top picks for wireless earbuds"
```

### In Content
```
✓ Good:   "Sponsored Content: This post contains affiliate links"
✓ Good:   "We may earn a commission from qualifying purchases"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Toggles not saving | Check browser console for errors; try refreshing |
| Affiliate link not working | Validate URL format; test in new tab |
| Disclosure not showing | Ensure "Enforce" is ON; check browser console |
| Links not highlighted | Enable "Highlight Affiliate Links" toggle |
| Stats not updating | Wait 5-10 minutes; check if post is published |

---

## FTC Compliance

This system helps meet FTC guidelines for:

✓ **Disclosure:** Show sponsorship relationship clearly  
✓ **Transparency:** Identify affiliate/sponsored nature  
✓ **Consent:** Users know they're clicking affiliate link  
✓ **Records:** Automatic tracking for substantiation  

**Best Practices:**

1. Always mark sponsored posts clearly
2. Enforce banner for paid partnerships
3. Use language: "We may earn a commission" or "Affiliate link"
4. Highlight links when multiple affiliate programs
5. Monitor analytics to understand audience impact

---

## Advanced Features

### Conditional Display

Show/hide affiliate elements based on user type:

```tsx
{post.is_sponsored && post.highlightAffiliateLinks && (
  <AffiliateHighlight href={url} postSlug={slug}>
    Link Text
  </AffiliateHighlight>
)}
```

### Custom Badge Text

Change badge from "affiliate" to custom text:

```tsx
<AffiliateHighlight
  href="..."
  badgeText="Premium Partner"
  showBadge={true}
>
  Click here
</AffiliateHighlight>
```

### Sponsored vs Affiliate

Different badge colors:

```tsx
// Affiliate programs (Amazon, AdThrive, etc.)
<PostAffiliateLink href="..." postSlug="...">Link</PostAffiliateLink>

// Sponsored content
<SponsoredLink href="..." postSlug="...">Link</SponsoredLink>
```

---

## Support & Questions

For issues with:
- **CMS Toggles:** Check browser console; contact admin
- **Affiliate Links:** Verify URL format and link validity
- **Analytics:** Check database sync; contact technical team
- **FTC Compliance:** Consult legal; review this guide

---

For more info: [AFFILIATE_SYSTEM.md](./AFFILIATE_SYSTEM.md)
