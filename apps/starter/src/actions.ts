import { action } from '@stra/core'
import { tree } from './tree'

export const inc = action(() => {
  tree.count++
})

export const dec = action(() => {
  tree.count--
})
