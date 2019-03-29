import fs from "fs";
import path from "path";
export const getJSFarmVersion = () => {
  const filePath = path.join(__dirname, "..", "VERSION");
  if (fs.existsSync(filePath)) {
    return fs
      .readFileSync(filePath)
      .toString()
      .trim();
  } else {
    return "development";
  }
};
