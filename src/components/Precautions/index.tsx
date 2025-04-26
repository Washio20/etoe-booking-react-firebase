import React from "react";

export default function Precautions() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white border border-[#BBBBBB] rounded-[4px] p-8">
        <h2 className="text-[15px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic mb-4">
          注意事項
        </h2>

        <div className="text-[13px] text-[#444444] tracking-[0.06em] leading-[1.65] font-zen-kaku-gothic space-y-4 max-h-[300px] overflow-y-auto pr-4">
          <section>
            <h3 className="font-medium">＜キャンセルポリシー＞</h3>
            <p>
              ・予約キャンセルは、予約開始時間の48時間前まで無料で可能です。以降はキャンセル料100％がかかりますのでお気を付けください。
              <br />
              （如何なる理由でも、キャンセル期限を過ぎますとキャンセル料100％がかかります。あらかじめご了承ください。）
            </p>
          </section>

          <section>
            <h3 className="font-medium">＜予約の確認、変更、キャンセル＞</h3>
            <p>
              ・ご予約頂いた内容に関しては、会員ページよりご確認頂けます。
              <br />
              ・ご予約のキャンセルは会員ページよりお願いします。
              <br />
              ・ご予約内容の変更は出来かねますので、一度キャンセルし、再予約をお願いします。
              <br />
              ・予約開始時間48時間前を過ぎると、それ以降の予約内容の変更はご対応出来かねます。
              <br />
              ※人数追加の場合のみ、現地で追加精算頂く形でご対応が可能です。
              <br />
              ・予約キャンセルをされた場合、「【etoe hotel】ご予約キャンセル確認」というメールが届いたら予約キャンセル確定となります。
              <br />
              メールが届かない場合はキャンセルが出来てませんので、再度キャンセル操作をお願いいたします。
            </p>
          </section>

          <section>
            <h3 className="font-medium">＜到着時間の遅れ＞</h3>
            <p>
              ・チェックアウトの時間は変わりませんので、遅れた時間分の利⽤時間が短くなります。
              <br />
              ・30分以上遅れた場合は当⽇キャンセルの扱いとなりますのでお気を付けください。
              <br />
              万が一30分以上遅れる場合は、メールにてご連絡ください。
              <br />
              予約終了時刻まで使用できますが、予約終了時刻の延長等の対応は出来かねますので予めご了承ください
            </p>
          </section>

          <section>
            <h3 className="font-medium">＜予約時間の延⻑＞</h3>
            <p>
              ・ご予約枠の前後の枠をご予約頂ければ、予約枠間のインターバルの時間込みで連続でご利用頂けます。
            </p>
          </section>

          <section>
            <h3 className="font-medium">＜予約開始のタイミングに関して＞</h3>
            <p>
              ・予約枠は本日含めて3週間先まで開放しています。※日付変更のタイミングで、更新されます。
            </p>
          </section>

          <section>
            <h3 className="font-medium">＜その他注意事項＞</h3>
            <p>
              ・飲酒されている方・熱(37.5℃以上)方はご利用できません。
              <br />
              ・ご予約･店頭での物販ともにキャッシュレス決済になります。
              <br />
              ・ご利用開始はご予約時間通りとなります。お時間まで3Fカフェスペースもご利用頂けます。
              <br />
              ・その他に質疑事項御座いましたら、【お問合せ】よりご連絡お願いします。
              <br />
              ・サウナルームは全面禁煙となります。
              <br />
              ・サウナルームは全面飲酒・お食事は禁止となります。
              <br />
              ・サウナルーム内にて備品や内装などの汚損や破損などがあった場合、修繕費用を請求させて頂きます。予めご了承下さい。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
