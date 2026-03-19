.PHONY: bump-version

# Usage: make bump-version V=0.2.0
bump-version:
ifndef V
	$(error Usage: make bump-version V=x.y.z)
endif
	@echo "Bumping version to $(V)..."
	@sed -i.bak 's/"version": "[^"]*"/"version": "$(V)"/' ui/src-tauri/tauri.conf.json
	@sed -i.bak 's/"version": "[^"]*"/"version": "$(V)"/' ui/package.json
	@sed -i.bak 's/^version = "[^"]*"/version = "$(V)"/' ui/src-tauri/Cargo.toml
	@sed -i.bak 's/FYF\.Photo\.Culler_[0-9]*\.[0-9]*\.[0-9]*/FYF.Photo.Culler_$(V)/g' README.md
	@sed -i.bak 's/FYF\.Photo\.Culler-[0-9]*\.[0-9]*\.[0-9]*-/FYF.Photo.Culler-$(V)-/g' README.md
	@rm -f ui/src-tauri/tauri.conf.json.bak ui/package.json.bak ui/src-tauri/Cargo.toml.bak README.md.bak
	@echo "Updated:"
	@grep '"version"' ui/src-tauri/tauri.conf.json | head -1
	@grep '"version"' ui/package.json | head -1
	@grep '^version' ui/src-tauri/Cargo.toml
	@grep -c '$(V)' README.md | xargs -I{} echo "  README.md: {} version references updated"
	@echo "Done! Don't forget to commit."
