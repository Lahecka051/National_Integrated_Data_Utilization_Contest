import type { AppMode, Errand, HalfDayType, RecommendationResponse } from '../types'

export type RootStackParamList = {
  Landing: undefined
  ErrandSelect: { mode: AppMode }
  DateSelect: { errands: Errand[]; mode: AppMode }
  Loading: { errands: Errand[]; mode: AppMode; date?: string; halfDay?: HalfDayType }
  Result: { result: RecommendationResponse; errands: Errand[]; mode: AppMode }
}
