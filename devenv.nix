{ pkgs, ... }:

{

  packages = [
    pkgs.nodejs_22
  ];

  languages.typescript = {
    enable = true;
  };

  enterShell = ''
    echo "🚀 TypeScript API Development"
    echo "Node.js: $(node --version)"
    echo "npm: $(npm --version)"
    echo ""
    [ ! -d "node_modules" ] && echo "Run 'npm install' to install dependencies"
  '';
}
