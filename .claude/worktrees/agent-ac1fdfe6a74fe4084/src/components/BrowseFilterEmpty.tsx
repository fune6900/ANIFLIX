/** 絞り込んだ結果、このページに該当作品が無いときの表示 */
export default function BrowseFilterEmpty() {
  return (
    <div className="text-center py-20 text-gray-500">
      条件に合う作品はこのページにありません。前後のページも確かめてください
    </div>
  );
}
