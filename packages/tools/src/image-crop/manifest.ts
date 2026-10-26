import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'image-crop',
  version: '1.0.0',
  name: '图片裁剪',
  description: '按坐标裁剪图片，自带 1:1 头像、证件照（一寸 / 二寸）等常用比例预设。',
  category: 'design',
  keywords: ['裁剪', '剪切', '头像', '证件照', 'crop', 'clipper'],
  legacyUrls: [
    'designer/picvideo/imageclipper',
    'life/picvideo/avatarcut',
    'designer/picvideo/idphotocut',
  ],
  desktop: {
    icon: 'Crop',
    window: { width: 1080, height: 700 },
    categories: ['design-image-video', 'life-image-video'],
    view: 'ImageCropTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
