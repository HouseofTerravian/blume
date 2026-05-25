import "dotenv/config";
import { listBrands } from "./src/brands/registry.js";
import { generatePost } from "./src/content/generator.js";

async function run() {
  // Test listBrands
  const brands = await listBrands();
  if (!brands || brands.length === 0) {
    process.stderr.write("FAIL: listBrands returned empty\n");
    process.exit(1);
  }
  process.stdout.write("BRANDS_OK:" + brands.length + ":" + brands.slice(0, 3).join(",") + "\n");

  // Test generatePost
  const post = await generatePost({
    brand: brands[0],
    platform: "twitter",
    topic: "summer festival season is here",
    mode: "collaborative",
  });
  if (!post || !post.content || post.content.length < 5) {
    process.stderr.write("FAIL: generatePost returned empty content\n");
    process.exit(1);
  }
  process.stdout.write("POST_OK:" + post.content.slice(0, 80).replace(/\n/g, " ") + "\n");
}

run().catch((e) => {
  process.stderr.write("FAIL: " + e.message + "\n");
  process.exit(1);
});
