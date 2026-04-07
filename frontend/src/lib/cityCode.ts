/**
 * 지역명 → TAGO cityCode 매핑 (TS 포팅)
 */

export const CITY_CODE_MAP: Record<string, number> = {
  '서울': 11, '서울특별시': 11,
  '부산': 21, '부산광역시': 21,
  '대구': 22, '대구광역시': 22,
  '인천': 23, '인천광역시': 23,
  '광주': 24, '광주광역시': 24,
  '대전': 25, '대전광역시': 25,
  '울산': 26, '울산광역시': 26,
  '세종': 29, '세종특별자치시': 29,
  '경기': 31, '경기도': 31,
  '강원': 32, '강원도': 32, '강원특별자치도': 32,
  '충북': 33, '충청북도': 33,
  '충남': 34, '충청남도': 34,
  '전북': 35, '전라북도': 35, '전북특별자치도': 35,
  '전남': 36, '전라남도': 36,
  '경북': 37, '경상북도': 37,
  '경남': 38, '경상남도': 38,
  '제주': 39, '제주도': 39, '제주특별자치도': 39,
}

export const MAJOR_CITY_MAIN_STATION: Record<string, string> = {
  '서울': '서울역',
  '부산': '부산역',
  '대구': '동대구역',
  '대전': '대전역',
  '광주': '광주송정역',
  '울산': '울산역',
  '인천': '인천역',
  '수원': '수원역',
  '천안': '천안아산역',
  '청주': '오송역',
  '전주': '전주역',
  '포항': '포항역',
  '여수': '여수엑스포역',
  '목포': '목포역',
  '강릉': '강릉역',
  '춘천': '춘천역',
  '창원': '창원중앙역',
  '진주': '진주역',
  '경주': '신경주역',
}

export function resolveCityCode(regionName: string): number | null {
  if (!regionName) return null
  const key = regionName.trim()
  if (key in CITY_CODE_MAP) return CITY_CODE_MAP[key]
  for (const [name, code] of Object.entries(CITY_CODE_MAP)) {
    if (name.includes(key) || key.includes(name)) return code
  }
  return null
}

export function suggestMainStation(cityName: string): string {
  if (!cityName) return ''
  const key = cityName.trim()
  if (key in MAJOR_CITY_MAIN_STATION) return MAJOR_CITY_MAIN_STATION[key]
  for (const [name, station] of Object.entries(MAJOR_CITY_MAIN_STATION)) {
    if (name.includes(key) || key.includes(name)) return station
  }
  return `${key}역`
}
