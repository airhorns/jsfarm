module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: __dirname + "/tsconfig.json"
  },
  plugins: ["@typescript-eslint", "jest"],
  extends: ["plugin:@typescript-eslint/recommended", "prettier", "prettier/@typescript-eslint", "plugin:jest/recommended"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_"
      }
    ]
  }
};
