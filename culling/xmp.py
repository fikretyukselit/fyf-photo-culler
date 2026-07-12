"""Write XMP sidecar files so review decisions survive into Lightroom/Bridge.

Sidecars are plain XML text (no python-xmp-toolkit or other dependency),
so this survives PyInstaller bundling unchanged.
"""

import os
from typing import Optional

_DEST_TO_RATING_LABEL = {
    "keep": (5, "Green"),
    "maybe": (3, "Yellow"),
    "reject": (1, "Red"),
    "blurry": (1, "Red"),
    "dark": (1, "Red"),
    "overexposed": (1, "Red"),
    "duplicate": (1, "Red"),
    "similar": (1, "Red"),
}

_XMP_TEMPLATE = """<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmp:Rating="{rating}"
        xmp:Label="{label}"/>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
"""


def build_xmp(rating: int, label: str) -> str:
    """Build the XMP sidecar XML text for a given star rating and color label."""
    return _XMP_TEMPLATE.format(rating=rating, label=label)


def write_sidecar(image_path: str, destination: str) -> Optional[str]:
    """Write <image_basename>.xmp next to the image.

    Returns the sidecar path, or None if destination has no mapping.
    Overwrites an existing sidecar.
    """
    mapping = _DEST_TO_RATING_LABEL.get(destination)
    if mapping is None:
        return None

    rating, label = mapping
    sidecar_path = os.path.splitext(image_path)[0] + ".xmp"
    content = build_xmp(rating, label)

    with open(sidecar_path, "w", encoding="utf-8") as f:
        f.write(content)

    return sidecar_path
