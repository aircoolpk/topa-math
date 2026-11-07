import { apiClient } from '@/lib/api-client'

export interface AvatarItem {
  id: string
  category: 'hair' | 'eyes' | 'outfit' | 'accessory' | 'background'
  name: string
  thumbnail_url: string | null
  is_default: boolean
  is_premium: boolean
}

export interface ChildInventory {
  id: string
  avatar_item_id: string
  quantity: number
  acquired_at: string
}

export interface AvatarConfig {
  gender?: 'girl' | 'boy'
  hair?: string
  eyes?: string
  outfit?: string
  accessory?: string
  background?: string
}

export const avatarApi = {
  async getItems() {
    const res = await apiClient.get('/avatar/items')
    return res.data as AvatarItem[]
  },

  async getInventory(childId: string) {
    const res = await apiClient.get(`/children/${childId}/inventory`)
    return res.data as ChildInventory[]
  },

  async updateAvatar(childId: string, avatarConfig: AvatarConfig) {
    const res = await apiClient.patch(`/children/${childId}/avatar`, avatarConfig)
    return res.data as { avatar_config: AvatarConfig }
  },
}
