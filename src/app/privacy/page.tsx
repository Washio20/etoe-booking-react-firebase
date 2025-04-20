import Layout from "@/components/Layout";

export default function PrivacyPolicyPage() {
  return (
    <Layout>
      <div className="max-w-[920px] mx-auto py-12">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="border-b border-[rgba(68,68,68,0.2)] pb-4">
            <h1 className="text-[24px] font-bold text-[#444444] tracking-[0.06em] font-zen-kaku-gothic">
              プライバシーポリシー
            </h1>
          </div>

          <div className="space-y-8 text-[13px] text-[#444444] tracking-[0.06em] leading-[1.8] font-zen-kaku-gothic">
            <p>
              junten株式会社（以下「当社」といいます。）ならびに当社が運営するウェブサイト（以下「当社ウェブサイト」といいます。）は、個人情報の重要性を認識し、以下のとおり、当社の運営するサウナ浴サービス（以下「当社サービス」といいます。）をご利用されるお客様（以下「お客様」といいます。）の個人情報の取扱いについて、プライバシーポリシー（以下「本プライバシーポリシー」といいます。）を定め、これを遵守することに努めてまいります。
            </p>
            <p>
              お客様におかれましては、本プライバシーポリシーの内容をご確認・ご理解した上でご利用ください。
            </p>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">第1条 法令遵守等</h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  当社は、個人情報の重要性を認識するとともに、その保護の徹底を図るため、個人情報保護法及び関連するその他の法令、ガイドライン等を遵守します。
                </li>
                <li>
                  当社は、個人情報を適切に管理するための管理責任者を置き、当社規程を役員及び従業員に周知し、その遵守徹底に努めます。また、取引先等に対しても適切に個人情報を取扱うよう要請します。
                </li>
                <li>
                  当社は、個人情報への不正アクセス、個人情報の漏えい、滅失、き損等の予防に努め、情報セキュリティの向上、是正を継続的に実施します。
                </li>
                <li>
                  当社は、お客様からの個人情報に関するお問い合わせ、開示等（利用目的の通知、開示、訂正・追加又は削除、利用停止等）のご請求に誠実かつ迅速に対応します。
                </li>
              </ol>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">第2条 利用目的</h2>
              <p>
                当社は、お客様の個人情報を適正な方法により取得し、あらかじめお客様の同意を得た場合及び法令等により例外として取り扱われる場合を除き、以下の利用目的の達成に必要な範囲で利用します。
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  当社サービスにおいて事故等が発生した場合等緊急時の連絡のため
                </li>
                <li>
                  当社サービスをお客様に提供するに際しての本人確認などの正確かつ公平適切な運営を行うため
                </li>
                <li>
                  営業、マーケティング又は広報活動に関連するお知らせのため
                </li>
                <li>問い合わせ、ご相談、苦情への対応のため</li>
                <li>
                  新型コロナウィルス感染症の感染拡大防止のため、保健所等の行政機関の要請に基づく個人情報の提供
                </li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">
                第3条 個人情報の第三者提供
              </h2>
              <p>
                当社は、法令の定める場合を除き、本人の同意なくして個人情報を第三者に開示及び提供することは致しません。
              </p>
              <p>
                なお、当社は、新型コロナウィルス感染症の感染拡大防止のため、保健所等の行政機関の要請に基づき個人情報を当該行政機関に提供する場合があります。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">
                第4条 個人情報等の適正管理と安全性の確保
              </h2>
              <ol className="list-decimal pl-5 space-y-2">
                <li>当社は、個人情報の管理を適正かつ厳重に行います。</li>
                <li>
                  当社は、個人情報への不正アクセス、個人情報の消失、破壊、改ざん、漏洩を防ぐために情報セキュリティ対策を行い、その有効性を定期的に監査し、継続的に改善します。
                </li>
              </ol>
              <p>
                ユーザーデータの削除はマイページより退会処理を行うことで可能です。
              </p>
              <p>
                また、ソーシャルログインはマイページのユーザー情報で連携、解除が可能です。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">
                第5条 保有個人データの開示等及び苦情の申出について
              </h2>
              <p>
                個人情報保護法に基づき当社の保有個人データの開示等（利用目的の通知、開示、訂正、追加又は削除、利用停止等）及び苦情の申出をご希望される場合には、下記「お問い合わせ先」記載の連絡先までご連絡ください。
              </p>
              <p>ご本人であることを確認の上、対応させていただきます。</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">
                第6条 クッキー（Cookie）の利用について
              </h2>
              <p>
                当社ウェブサイトでは、より良いサービスを目的に、お客様のクッキー（Cookie（お客様のパソコンやスマートフォン等に記録されているウェブサイト閲覧情報をいいます。
                これを利用することでお客様がウェブサイトへアクセスするたびに設定を繰り返す必要がなくなるなど、効率的な運用が可能となります。））を以下の目的で使用することがあります。
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>お客様の当サイト利用に関する利便性向上のため</li>
                <li>ウェブサイトのパフォーマンス改善のため</li>
                <li>お客様へ提供するサービスの向上、改善のため</li>
              </ul>
              <p>
                また、より良いサービスをご提供できるよう、アクセス状況・トラフィック・サイト回遊等の情報の分析にあたり以下のツールを利用し、ツール提供者に情報提供されることがあります。
              </p>
              <ul className="list-disc pl-5">
                <li>Google Analytics</li>
              </ul>
              <p>
                なお、クッキー（Cookie）は、当社ウェブサイトにおいてお客様へよりよいサービスを提供するためのものであり、クッキー（Cookie）により収集される情報からお客様個人を特定するものではありません。
              </p>
              <p>
                お客様は、インターネット閲覧ソフトの設定でクッキー（Cookie）の機能を無効にすることができます。
              </p>
              <p>
                但し、その場合には、当社ウェブサイトの一部の機能が使用できない等の制限が生じることがございます。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">
                第7条 プライバシーポリシーの変更
              </h2>
              <p>
                本プライバシーポリシーの内容は、法令その他、本プライバシーポリシーに別段の定めのある事項を除いて、お客様に通知することなく、変更することができるものとします。
              </p>
              <p>
                当社が別途定める場合を除いて、変更後のプライバシーポリシーは、当社ウェブサイトに掲載したときから効力が生じるものとします。
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">個人情報管理責任者</h2>
              <p>junten株式会社</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-[15px] font-medium">お問い合わせ</h2>
              <p>
                本サービスにおけるプライバシーポリシーおよび個人情報の取り扱いに関するお問い合わせは、下記窓口までご連絡ください。
              </p>
              <div>
                <p>junten株式会社</p>
                <p>住所：東京都新宿区百人町2-20-24</p>
                <p>
                  お問い合わせ：
                  <a
                    href="https://etoehotel.com/contact/"
                    className="text-[#444444] underline"
                  >
                    https://etoehotel.com/contact/
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
