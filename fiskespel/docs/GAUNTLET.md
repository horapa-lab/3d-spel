# The 3D Gauntlet

Pass mark: **8 / 10** from an independent reviewer, for **every** model and scene. Nothing ships below 8.

## Scale

| Score | Meaning |
|---|---|
| 10 | Indistinguishable from a top-tier commercial stylised-realistic game asset. |
| 9 | Excellent. Would be a highlight asset in a polished indie release. |
| **8** | **Polished and attractive. Strong silhouette, convincing materials, good detail density, no visible artifacts. Would ship in a high-quality web/mobile game without anyone calling it "programmer art".** |
| 7 | Decent, but something is noticeably amateur (flat or plasticky material, blobby or primitive shapes, wrong proportions, low detail, bland colour). |
| 5–6 | Clearly placeholder-ish or has obvious errors. |
| ≤ 4 | Broken or unrecognisable. |

## Criteria

1. **Silhouette & proportions**: instantly readable, correct anatomy/structure (fish: eye, gill
   cover, mouth, dorsal/pectoral/pelvic/anal/caudal fins placed plausibly for the species type;
   rods: butt, grip, reel seat + reel, guides, tapered blank, tip).
2. **Materials & shading**: PBR that looks like the real material (wet scales with iridescence,
   varnished wood grain, brushed metal, cloth), no uniform flat colours, subtle variation and
   gradients, correct normals and smooth shading where needed.
3. **Detail & finish**: surface detail (scales, grain, stitching, rivets, wear), bevels, no gaps,
   intersections, z-fighting, stretched textures or inside-out faces.
4. **Distinctiveness**: clearly different from the other items in the same set; rarity reads
   visually (rarer = more striking).
5. **Art direction fit**: "premium stylised realism" (see CONTRACT.md).
6. **Technical**: within the triangle budget.

For **water/scene** shots: realism of waves (multi-scale, not repeating tiles), reflections, fresnel,
subsurface colour, foam (crests + shoreline), specular sun glint, horizon blend, sky/fog coherence,
lighting mood per time/weather.

## Reviewer output (JSON written to `review/results/<batch>.json`)

```json
[
  { "id": "harbor_perch", "score": 8, "verdict": "pass",
    "strengths": ["…"], "issues": ["…"], "fixes": ["concrete, actionable change"] }
]
```

A reviewer never sees the code, only images and the one-line description of what each item should be.
Reviewers are strict: when unsure between two scores, give the lower one.
