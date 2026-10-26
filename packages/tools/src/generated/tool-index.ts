// 由 scripts/generate-tool-index.ts 自动生成，请勿手工修改

import { base64Image } from '../base64-image/index'
import { bmiCalculator } from '../bmi-calculator/index'
import { charLookup } from '../char-lookup/index'
import { charStrokeOrder } from '../char-stroke-order/index'
import { colorCodec } from '../color-codec/index'
import { colorList } from '../color-list/index'
import { colorSelect } from '../color-select/index'
import { constellation } from '../constellation/index'
import { contentType } from '../content-type/index'
import { currentIp } from '../current-ip/index'
import { fileBase64 } from '../file-base64/index'
import { fileHash } from '../file-hash/index'
import { fullwidthHalfwidth } from '../fullwidth-halfwidth/index'
import { getColorThief } from '../getcolorthief/index'
import { gif2frames } from '../gif2frames/index'
import { githubTrending } from '../github-trending/index'
import { idCard } from '../id-card/index'
import { idiomQuery } from '../idiom-query/index'
import { imageCompress } from '../image-compress/index'
import { imageCrop } from '../image-crop/index'
import { imageRound } from '../image-round/index'
import { imageViewer } from '../image-viewer/index'
import { imageWatermark } from '../image-watermark/index'
import { ipQuery } from '../ip-query/index'
import { kaomoji } from '../kaomoji/index'
import { m3u8Player } from '../m3u8-player/index'
import { markdownConverter } from '../markdown-converter/index'
import { notes } from '../notes/index'
import { passwordStrength } from '../password-strength/index'
import { pasteImageView } from '../paste-image-view/index'
import { pinyinConvert } from '../pinyin-convert/index'
import { pinyinSort } from '../pinyin-sort/index'
import { placeholderImage } from '../placeholder-image/index'
import { qrCode } from '../qrcode/index'
import { randomString } from '../random-string/index'
import { reactionTest } from '../reaction-test/index'
import { removeCharacter } from '../remove-character/index'
import { screenCheck } from '../screencheck/index'
import { simplifiedTraditional } from '../simplified-traditional/index'
import { specialSymbols } from '../special-symbols/index'
import { storageSize } from '../storage-size/index'
import { strokeCount } from '../stroke-count/index'
import { symmetricCrypto } from '../symmetric-crypto/index'
import { textAutoSpace } from '../text-auto-space/index'
import { textDiff } from '../text-diff/index'
import { textHex } from '../text-hex/index'
import { textLength } from '../text-length/index'
import { textTransform } from '../text-transform/index'
import { text2Image } from '../text2image/index'
import { unicodeCodec } from '../unicode-codec/index'
import { urlCodec } from '../url-codec/index'
import { weiboUser } from '../weibo-user/index'
import { zeroWidthCodec } from '../zero-width-codec/index'

/** 内置工具插件清单（顺序按工具 ID 排序） */
export const builtinPlugins = [
  base64Image,
  bmiCalculator,
  charLookup,
  charStrokeOrder,
  colorCodec,
  colorList,
  colorSelect,
  constellation,
  contentType,
  currentIp,
  fileBase64,
  fileHash,
  fullwidthHalfwidth,
  getColorThief,
  gif2frames,
  githubTrending,
  idCard,
  idiomQuery,
  imageCompress,
  imageCrop,
  imageRound,
  imageViewer,
  imageWatermark,
  ipQuery,
  kaomoji,
  m3u8Player,
  markdownConverter,
  notes,
  passwordStrength,
  pasteImageView,
  pinyinConvert,
  pinyinSort,
  placeholderImage,
  qrCode,
  randomString,
  reactionTest,
  removeCharacter,
  screenCheck,
  simplifiedTraditional,
  specialSymbols,
  storageSize,
  strokeCount,
  symmetricCrypto,
  textAutoSpace,
  textDiff,
  textHex,
  textLength,
  textTransform,
  text2Image,
  unicodeCodec,
  urlCodec,
  weiboUser,
  zeroWidthCodec
]

export const builtinPluginIds = builtinPlugins.map((plugin) => plugin.id)
