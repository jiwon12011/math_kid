#!/bin/bash
# 한글 텍스트(새 동물/문구 등)를 추가한 뒤 폰트가 깨지면 이 스크립트를 실행해 재서브셋.
# 필요: fonttools(pyftsubset). 설치: pip3 install fonttools brotli
set -e
cd "$(dirname "$0")/.."
cat index.html js/*.js css/*.css > /tmp/_fontsrc.txt
for spec in "jua:jua"; do
  id="${spec%%:*}"; name="${spec##*:}"
  curl -s -L -A "Mozilla/5.0" "https://cdn.jsdelivr.net/fontsource/fonts/${id}@latest/korean-400-normal.woff2" -o /tmp/${name}-full.woff2
  pyftsubset /tmp/${name}-full.woff2 --text-file=/tmp/_fontsrc.txt --flavor=woff2 \
    --layout-features='*' --output-file=assets/fonts/${name}-korean.woff2
  echo "${name}-korean: $(stat -f%z assets/fonts/${name}-korean.woff2) bytes"
done
echo "재서브셋 완료. sw.js의 CACHE 버전을 올리는 것을 잊지 마세요."
