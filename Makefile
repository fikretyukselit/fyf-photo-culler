.PHONY: bump-version

# Usage: make bump-version V=0.2.0
bump-version:
ifndef V
	$(error Usage: make bump-version V=x.y.z)
endif
	@echo "Bumping version to $(V)..."
	@sed -i '' 's/"version": "[^"]*"/"version": "$(V)"/' ui/src-tauri/tauri.conf.json
	@sed -i '' 's/"version": "[^"]*"/"version": "$(V)"/' ui/package.json
	@sed -i '' 's/^version = "[^"]*"/version = "$(V)"/' ui/src-tauri/Cargo.toml
	@echo "Updated:"
	@grep '"version"' ui/src-tauri/tauri.conf.json | head -1
	@grep '"version"' ui/package.json | head -1
	@grep '^version' ui/src-tauri/Cargo.toml
	@echo "Done! Don't forget to commit."
